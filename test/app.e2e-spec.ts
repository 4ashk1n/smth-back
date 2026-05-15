import { INestApplication } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './e2e/create-test-app';
import { createAuthCookies } from './e2e/auth-helpers';
import { clearDatabase } from './e2e/db-utils';
import { createArticle } from './factories/article.factory';
import { createCategory } from './factories/category.factory';
import { createUser } from './factories/user.factory';

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authService: AuthService;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app as INestApplication<App>;
    prisma = ctx.prisma;
    authService = ctx.authService;
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('auth', () => {
    it('GET /api/auth/me returns 401 without auth', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('GET /api/auth/me returns 200 with valid auth cookies', async () => {
      const { user, cookies } = await createAuthCookies(authService, prisma);

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(user.id);
    });

    it('POST /api/auth/refresh rotates tokens and logout invalidates refresh token', async () => {
      const { refreshCookie } = await createAuthCookies(authService, prisma);

      const refreshResponse = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(201);

      expect(refreshResponse.body.success).toBe(true);

      const setCookieHeader = refreshResponse.get('set-cookie') ?? [];
      const nextRefreshCookie = setCookieHeader.find((cookie) => cookie.startsWith('refresh_token='));
      expect(nextRefreshCookie).toBeDefined();

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', nextRefreshCookie as string)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', nextRefreshCookie as string)
        .expect(401);
    });
  });

  describe('categories', () => {
    it('supports list/create/get/update/delete flow', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/categories')
        .send({ name: 'Science', emoji: 'book', colors: { lightColor: '#fff', darkColor: '#111', accentColor: '#333' } })
        .expect(201);

      const categoryId = created.body.data.id;
      expect(categoryId).toBeDefined();

      await request(app.getHttpServer()).get('/api/categories').expect(200);
      await request(app.getHttpServer()).get(`/api/categories/${categoryId}`).expect(200);
      await request(app.getHttpServer())
        .patch(`/api/categories/${categoryId}`)
        .send({ name: 'Science 2' })
        .expect(200);
      await request(app.getHttpServer()).delete(`/api/categories/${categoryId}`).expect(200);
    });
  });

  describe('users', () => {
    it('supports profile and subscriptions endpoints', async () => {
      const { user: actor, cookies } = await createAuthCookies(authService, prisma);
      const target = await createUser(prisma);

      await request(app.getHttpServer()).get('/api/users').expect(200);
      await request(app.getHttpServer()).get(`/api/users/${target.id}`).expect(200);

      await request(app.getHttpServer())
        .patch(`/api/users/${actor.id}`)
        .set('Cookie', cookies)
        .send({ firstname: 'Updated', lastname: 'User' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/users/${target.id}/subscribe`)
        .set('Cookie', cookies)
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/users/${target.id}/subscribed`)
        .set('Cookie', cookies)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/users/${target.id}/subscribe`)
        .set('Cookie', cookies)
        .expect(200);
    });
  });

  describe('articles', () => {
    it('supports draft/comment/metrics/reaction endpoints', async () => {
      const { user, cookies } = await createAuthCookies(authService, prisma);
      const category = await createCategory(prisma);

      const createDraftResponse = await request(app.getHttpServer())
        .post('/api/articles/empty-draft')
        .set('Cookie', cookies)
        .send({ authorId: user.id })
        .expect(201);

      const draftId = createDraftResponse.body.data.id as string;
      expect(draftId).toBeDefined();

      await request(app.getHttpServer())
        .post(`/api/articles/${draftId}/draft`)
        .set('Cookie', cookies)
        .send({ title: 'Draft Title', mainCategoryId: category.id, categoryIds: [category.id] })
        .expect(201);

      const published = await prisma.article.create({
        data: {
          title: 'Published',
          description: 'Published article',
          content: {},
          authorId: user.id,
          mainCategoryId: category.id,
          status: 'published',
          publishedAt: new Date(),
          categories: { connect: [{ id: category.id }] },
        },
      });

      await request(app.getHttpServer()).get('/api/articles?page=1&limit=10').expect(200);
      await request(app.getHttpServer()).get(`/api/articles/${published.id}`).expect(200);
      await request(app.getHttpServer()).get(`/api/articles/${published.id}/content`).expect(200);
      await request(app.getHttpServer()).get(`/api/articles/${published.id}/metrics`).expect(200);

      await request(app.getHttpServer())
        .post(`/api/articles/${published.id}/metrics/read`)
        .set('Cookie', cookies)
        .send({ focusTime: 12, viewedPages: 2 })
        .expect(201);

      const commentResponse = await request(app.getHttpServer())
        .post(`/api/articles/${published.id}/comments`)
        .set('Cookie', cookies)
        .send({ text: 'Nice article' })
        .expect(201);

      const commentId = commentResponse.body.data.id as string;
      await request(app.getHttpServer()).get(`/api/articles/${published.id}/comments?page=1&limit=10`).expect(200);
      await request(app.getHttpServer())
        .delete(`/api/articles/${published.id}/comments/${commentId}`)
        .set('Cookie', cookies)
        .expect(200);

      await request(app.getHttpServer()).post(`/api/articles/${published.id}/like`).set('Cookie', cookies).expect(201);
      await request(app.getHttpServer()).delete(`/api/articles/${published.id}/like`).set('Cookie', cookies).expect(200);
      await request(app.getHttpServer()).post(`/api/articles/${published.id}/dislike`).set('Cookie', cookies).expect(201);
      await request(app.getHttpServer()).delete(`/api/articles/${published.id}/dislike`).set('Cookie', cookies).expect(200);
      await request(app.getHttpServer()).post(`/api/articles/${published.id}/save`).set('Cookie', cookies).expect(201);
      await request(app.getHttpServer()).delete(`/api/articles/${published.id}/save`).set('Cookie', cookies).expect(200);
      await request(app.getHttpServer()).post(`/api/articles/${published.id}/repost`).set('Cookie', cookies).expect(201);
      await request(app.getHttpServer()).delete(`/api/articles/${published.id}/repost`).set('Cookie', cookies).expect(200);

      await request(app.getHttpServer()).get('/api/articles/feed?page=1&limit=10').set('Cookie', cookies).expect(200);
      await request(app.getHttpServer())
        .get(`/api/articles/${draftId}/review-remarks`)
        .set('Cookie', cookies)
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/api/articles/${draftId}/draft`)
        .set('Cookie', cookies)
        .expect(200);
    });
  });

  describe('notifications', () => {
    it('supports list/count/mark-read endpoints for authorized user', async () => {
      const { user, cookies } = await createAuthCookies(authService, prisma);
      await prisma.notification.create({
        data: {
          type: 'like' as NotificationType,
          recipientUserId: user.id,
          payload: { from: 'e2e' },
        },
      });

      const list = await request(app.getHttpServer())
        .get('/api/notifications?page=1&limit=10')
        .set('Cookie', cookies)
        .expect(200);

      const notificationId = list.body.data.items[0].id as string;
      await request(app.getHttpServer()).get('/api/notifications/unread-count').set('Cookie', cookies).expect(200);
      await request(app.getHttpServer()).post(`/api/notifications/${notificationId}/read`).set('Cookie', cookies).expect(201);
      await request(app.getHttpServer()).post('/api/notifications/read-all').set('Cookie', cookies).expect(201);
    });
  });

  describe('search', () => {
    it('supports users/articles/categories search endpoints', async () => {
      const user = await createUser(prisma, { username: 'search_user' });
      const category = await createCategory(prisma, { name: 'Searchable category' });
      await createArticle(prisma, {
        authorId: user.id,
        mainCategoryId: category.id,
        title: 'Searchable article',
        status: 'published',
      });

      await request(app.getHttpServer()).get('/api/search/users?q=search').expect(200);
      await request(app.getHttpServer()).get('/api/search/articles?q=search').expect(200);
      await request(app.getHttpServer()).get('/api/search/categories?q=search').expect(200);
    });
  });

  describe('storage', () => {
    it('supports protected storage endpoints', async () => {
      const { user, cookies } = await createAuthCookies(authService, prisma);

      await request(app.getHttpServer())
        .post('/api/uploads/images/upload-url')
        .set('Cookie', cookies)
        .send({ filename: 'image.png', contentType: 'image/png' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/uploads/images/confirm')
        .set('Cookie', cookies)
        .send({ key: 'images/e2e.png' })
        .expect(201);
    });
  });

  describe('ai', () => {
    it('supports protected ai suggestion endpoints', async () => {
      const { user, cookies } = await createAuthCookies(authService, prisma);
      const category = await createCategory(prisma);
      const draft = await createArticle(prisma, {
        authorId: user.id,
        mainCategoryId: category.id,
        status: 'draft',
      });

      await request(app.getHttpServer())
        .post('/api/ai/suggestions/layout')
        .set('Cookie', cookies)
        .send({ draftId: draft.id })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/ai/suggestions/text')
        .set('Cookie', cookies)
        .send({ draftId: draft.id })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/ai/suggestions/all')
        .set('Cookie', cookies)
        .send({ draftId: draft.id })
        .expect(201);
    });
  });

  describe('admin access', () => {
    it('rejects normal user and allows admin user for admin routes', async () => {
      const { cookies: userCookies } = await createAuthCookies(authService, prisma, 'user');
      const { cookies: adminCookies } = await createAuthCookies(authService, prisma, 'admin');

      await request(app.getHttpServer()).get('/api/admin/users?page=1&limit=10').set('Cookie', userCookies).expect(403);
      await request(app.getHttpServer()).get('/api/admin/users?page=1&limit=10').set('Cookie', adminCookies).expect(200);
    });
  });
});
