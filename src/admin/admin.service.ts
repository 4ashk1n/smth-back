import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AdminModerateArticleResponseSchema,
  AdminReviewArticleListResponseSchema,
  AdminReviewArticleListQuerySchema,
  AdminUserArticleListResponseSchema,
  AdminUserArticleListQuerySchema,
  AdminUserListResponseSchema,
  AdminUserListQuerySchema,
  ReviewRemarkListResponseSchema,
  ReviewRemarkResponseSchema,
  ReviewRemarkUpsertSchema,
  type AdminModerateArticleResponse,
  type AdminReviewArticleListResponse,
  type AdminUserArticleListResponse,
  type AdminUserListResponse,
  type ReviewRemarkListResponse,
  type ReviewRemarkResponse,
  type ReviewRemarkUpsert,
} from "@smth/shared";
import type { z } from "zod";
import { NotificationService } from "../notification/notification.service";
import { PrismaService } from "../prisma/prisma.service";

type ReviewArticleListQuery = z.infer<typeof AdminReviewArticleListQuerySchema>;
type UserListQuery = z.infer<typeof AdminUserListQuerySchema>;
type UserArticleListQuery = z.infer<typeof AdminUserArticleListQuerySchema>;
type AdminModerateUserResponse = {
  success: true;
  data: {
    id: string;
    username: string;
    firstname: string;
    lastname: string;
    avatar: string;
    role: "user" | "moderator" | "admin";
    email: string | null;
    provider: string | null;
    isBanned: boolean;
    bannedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async listReviewArticles(query: ReviewArticleListQuery): Promise<AdminReviewArticleListResponse> {
    const parsedQuery = AdminReviewArticleListQuerySchema.parse(query);
    const { page, limit, search, authorId } = parsedQuery;
    const skip = (page - 1) * limit;

    const where: any = {
      status: "review",
    };

    if (authorId) {
      where.authorId = authorId;
    }

    if (search?.trim()) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          authorId: true,
          mainCategoryId: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          categories: { select: { id: true } },
        },
      }),
    ]);

    return AdminReviewArticleListResponseSchema.parse({
      success: true,
      data: {
        items: rows.map((row) => this.toArticleMeta(row)),
        total,
        page,
        limit,
        hasMore: skip + rows.length < total,
      },
    });
  }

  async approveArticle(articleId: string, actorUserId: string): Promise<AdminModerateArticleResponse> {
    const existing = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException("Article not found");
    if (existing.status !== "review") {
      throw new BadRequestException("Only review articles can be approved");
    }

    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: "published",
        publishedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        description: true,
        authorId: true,
        mainCategoryId: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        categories: { select: { id: true } },
      },
    });

    await this.notificationService.createNotification({
      type: "article_status",
      recipientUserId: updated.authorId,
      actorUserId,
      payload: {
        articleId: updated.id,
        articleTitle: updated.title,
        fromStatus: existing.status,
        toStatus: updated.status,
      },
    });

    return AdminModerateArticleResponseSchema.parse({
      success: true,
      data: this.toArticleMeta(updated),
    });
  }

  async rejectArticle(articleId: string, actorUserId: string): Promise<AdminModerateArticleResponse> {
    const existing = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException("Article not found");
    if (existing.status !== "review") {
      throw new BadRequestException("Only review articles can be rejected");
    }

    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: "draft",
        publishedAt: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        authorId: true,
        mainCategoryId: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        categories: { select: { id: true } },
      },
    });

    await this.notificationService.createNotification({
      type: "article_status",
      recipientUserId: updated.authorId,
      actorUserId,
      payload: {
        articleId: updated.id,
        articleTitle: updated.title,
        fromStatus: existing.status,
        toStatus: updated.status,
      },
    });

    return AdminModerateArticleResponseSchema.parse({
      success: true,
      data: this.toArticleMeta(updated),
    });
  }

  async archiveArticle(articleId: string, actorUserId: string): Promise<AdminModerateArticleResponse> {
    const existing = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException("Article not found");
    if (existing.status === "archived") {
      throw new BadRequestException("Article is already archived");
    }

    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: "archived",
        publishedAt: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        authorId: true,
        mainCategoryId: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        categories: { select: { id: true } },
      },
    });

    await this.notificationService.createNotification({
      type: "article_status",
      recipientUserId: updated.authorId,
      actorUserId,
      payload: {
        articleId: updated.id,
        articleTitle: updated.title,
        fromStatus: existing.status,
        toStatus: updated.status,
      },
    });

    return AdminModerateArticleResponseSchema.parse({
      success: true,
      data: this.toArticleMeta(updated),
    });
  }

  async publishArchivedArticle(articleId: string, actorUserId: string): Promise<AdminModerateArticleResponse> {
    const existing = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException("Article not found");
    if (existing.status !== "archived") {
      throw new BadRequestException("Only archived articles can be published");
    }

    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: {
        status: "published",
        publishedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        description: true,
        authorId: true,
        mainCategoryId: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        categories: { select: { id: true } },
      },
    });

    await this.notificationService.createNotification({
      type: "article_status",
      recipientUserId: updated.authorId,
      actorUserId,
      payload: {
        articleId: updated.id,
        articleTitle: updated.title,
        fromStatus: existing.status,
        toStatus: updated.status,
      },
    });

    return AdminModerateArticleResponseSchema.parse({
      success: true,
      data: this.toArticleMeta(updated),
    });
  }

  async listUsers(query: UserListQuery): Promise<AdminUserListResponse> {
    const parsedQuery = AdminUserListQuerySchema.parse(query);
    const { page, limit, search } = parsedQuery;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search?.trim()) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { firstname: { contains: search, mode: "insensitive" } },
        { lastname: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          firstname: true,
          lastname: true,
          avatar: true,
          role: true,
          email: true,
          provider: true,
          isBanned: true,
          bannedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        items: rows,
        total,
        page,
        limit,
        hasMore: skip + rows.length < total,
      },
    } as AdminUserListResponse;
  }

  async banUser(userId: string, actorUserId: string): Promise<AdminModerateUserResponse> {
    if (userId === actorUserId) {
      throw new BadRequestException("You cannot ban yourself");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true },
    });
    if (!existing) throw new NotFoundException("User not found");
    if (existing.isBanned) {
      throw new BadRequestException("User is already banned");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const bannedUser = await tx.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          bannedAt: new Date(),
          refreshTokenHash: null,
        },
        select: {
          id: true,
          username: true,
          firstname: true,
          lastname: true,
          avatar: true,
          role: true,
          email: true,
          provider: true,
          isBanned: true,
          bannedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.article.updateMany({
        where: {
          authorId: userId,
          status: {
            not: "archived",
          },
        },
        data: {
          status: "archived",
          publishedAt: null,
        },
      });

      return bannedUser;
    });

    return {
      success: true,
      data: updated,
    };
  }

  async unbanUser(userId: string, actorUserId: string): Promise<AdminModerateUserResponse> {
    if (userId === actorUserId) {
      throw new BadRequestException("You cannot unban yourself");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true },
    });
    if (!existing) throw new NotFoundException("User not found");
    if (!existing.isBanned) {
      throw new BadRequestException("User is not banned");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        bannedAt: null,
      },
      select: {
        id: true,
        username: true,
        firstname: true,
        lastname: true,
        avatar: true,
        role: true,
        email: true,
        provider: true,
        isBanned: true,
        bannedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: updated,
    };
  }

  async listUserArticles(userId: string, query: UserArticleListQuery): Promise<AdminUserArticleListResponse> {
    const parsedQuery = AdminUserArticleListQuerySchema.parse(query);
    const { page, limit, status, search } = parsedQuery;
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const where: any = { authorId: userId };
    if (status) {
      where.status = status;
    }
    if (search?.trim()) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          description: true,
          authorId: true,
          mainCategoryId: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          categories: { select: { id: true } },
        },
      }),
    ]);

    return AdminUserArticleListResponseSchema.parse({
      success: true,
      data: {
        items: rows.map((row) => this.toArticleMeta(row)),
        total,
        page,
        limit,
        hasMore: skip + rows.length < total,
      },
    });
  }

  async listArticleRemarks(articleId: string): Promise<ReviewRemarkListResponse> {
    await this.ensureArticleExists(articleId);
    const prisma: any = this.prisma;

    const rows = await prisma.articleBlockRemark.findMany({
      where: { articleId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        articleId: true,
        blockId: true,
        authorId: true,
        text: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            firstname: true,
            lastname: true,
            avatar: true,
          },
        },
      },
    });

    return ReviewRemarkListResponseSchema.parse({
      success: true,
      data: rows,
    });
  }

  async upsertArticleRemark(
    articleId: string,
    blockId: string,
    authorId: string,
    dto: ReviewRemarkUpsert,
  ): Promise<ReviewRemarkResponse> {
    await this.ensureArticleExists(articleId);
    const payload = ReviewRemarkUpsertSchema.parse(dto);
    await this.ensureBlockBelongsToArticle(articleId, blockId);
    const prisma: any = this.prisma;

    const row = await prisma.articleBlockRemark.upsert({
      where: {
        articleId_blockId: {
          articleId,
          blockId,
        },
      },
      update: {
        text: payload.text,
        authorId,
      },
      create: {
        articleId,
        blockId,
        authorId,
        text: payload.text,
      },
      select: {
        id: true,
        articleId: true,
        blockId: true,
        authorId: true,
        text: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            firstname: true,
            lastname: true,
            avatar: true,
          },
        },
      },
    });

    return ReviewRemarkResponseSchema.parse({
      success: true,
      data: row,
    });
  }

  async deleteArticleRemark(articleId: string, blockId: string): Promise<ReviewRemarkResponse> {
    await this.ensureArticleExists(articleId);
    const prisma: any = this.prisma;

    const existing = await prisma.articleBlockRemark.findUnique({
      where: {
        articleId_blockId: {
          articleId,
          blockId,
        },
      },
      select: {
        id: true,
        articleId: true,
        blockId: true,
        authorId: true,
        text: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            firstname: true,
            lastname: true,
            avatar: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Remark not found");
    }

    await prisma.articleBlockRemark.delete({
      where: {
        articleId_blockId: {
          articleId,
          blockId,
        },
      },
    });

    return ReviewRemarkResponseSchema.parse({
      success: true,
      data: existing,
    });
  }

  private toArticleMeta(row: {
    id: string;
    title: string;
    description: string | null;
    authorId: string;
    mainCategoryId: string;
    status: "published" | "draft" | "archived" | "review";
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    categories: Array<{ id: string }>;
  }) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      authorId: row.authorId,
      mainCategoryId: row.mainCategoryId,
      categories: row.categories.map((c) => c.id),
      status: row.status,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async ensureArticleExists(articleId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true },
    });
    if (!article) throw new NotFoundException("Article not found");
  }

  private async ensureBlockBelongsToArticle(articleId: string, blockId: string) {
    const block = await this.prisma.block.findFirst({
      where: {
        id: blockId,
        page: {
          topic: {
            articleId,
          },
        },
      },
      select: { id: true },
    });
    if (!block) {
      throw new BadRequestException("Block does not belong to this article");
    }
  }
}
