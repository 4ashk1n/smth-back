import { ArticleStatus } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';

type CreateArticleParams = {
  authorId: string;
  mainCategoryId: string;
  title?: string;
  status?: ArticleStatus;
};

export async function createArticle(prisma: PrismaService, params: CreateArticleParams) {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return prisma.article.create({
    data: {
      title: params.title ?? `Article ${suffix}`,
      description: 'E2E article',
      content: [],
      authorId: params.authorId,
      mainCategoryId: params.mainCategoryId,
      status: params.status ?? 'draft',
    },
  });
}
