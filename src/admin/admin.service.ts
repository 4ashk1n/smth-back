import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AdminModerateArticleResponseSchema,
  AdminReviewArticleListResponseSchema,
  AdminReviewArticleListQuerySchema,
  AdminUserArticleListResponseSchema,
  AdminUserArticleListQuerySchema,
  AdminUserListResponseSchema,
  AdminUserListQuerySchema,
  type AdminModerateArticleResponse,
  type AdminReviewArticleListResponse,
  type AdminUserArticleListResponse,
  type AdminUserListResponse,
} from "@smth/shared";
import type { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

type ReviewArticleListQuery = z.infer<typeof AdminReviewArticleListQuerySchema>;
type UserListQuery = z.infer<typeof AdminUserListQuerySchema>;
type UserArticleListQuery = z.infer<typeof AdminUserArticleListQuerySchema>;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

  async approveArticle(articleId: string): Promise<AdminModerateArticleResponse> {
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

    return AdminModerateArticleResponseSchema.parse({
      success: true,
      data: this.toArticleMeta(updated),
    });
  }

  async rejectArticle(articleId: string): Promise<AdminModerateArticleResponse> {
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
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return AdminUserListResponseSchema.parse({
      success: true,
      data: {
        items: rows,
        total,
        page,
        limit,
        hasMore: skip + rows.length < total,
      },
    });
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
}
