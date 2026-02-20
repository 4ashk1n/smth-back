import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ArticleDTOSchema,
  ArticleListQuerySchema,
  ArticleMetaSchema,
  CategorySchema,
  CreateArticleSchema,
  UpdateArticleSchema,
} from "@smth/shared";
import type { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

type ArticleMeta = z.infer<typeof ArticleMetaSchema>;
type ArticleDTO = z.infer<typeof ArticleDTOSchema>;
type CreateDto = z.infer<typeof CreateArticleSchema>;
type UpdateDto = z.infer<typeof UpdateArticleSchema>;
type ListQuery = z.infer<typeof ArticleListQuerySchema>;

@Injectable()
export class ArticleService {
  private testAuthorId: string | null = null;
  private testCategoryId: string | null = null;

  constructor(private readonly prisma: PrismaService) { }

  private mapCategoryToShared(cat: {
    id: string;
    name: string;
    emoji: string;
    colors: any
  }): z.infer<typeof CategorySchema> {
    return {
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji,
      colors: {
        lightColor: cat.colors.lightColor,
        darkColor: cat.colors.darkColor,
        accentColor: cat.colors.accentColor,
      },
    };
  }

  async list(query: ListQuery) {
    const { page, limit, status, categoryId, authorId, search } = query;

    const where: any = {};

    if (status) where.status = status;
    if (authorId) where.authorId = authorId;

    if (categoryId) {
      where.OR = [
        { mainCategoryId: categoryId },
        { categories: { some: { id: categoryId } } },
      ];
    }

    if (search?.trim()) {
      where.OR = [
        ...(where.OR ?? []),
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          mainCategoryId: true,
          categories: { select: { id: true } },
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    const items: ArticleMeta[] = rows.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description ?? "", // shared требует string
      mainCategory: a.mainCategoryId,
      categories: a.categories.map((c) => c.id),
      status: a.status,
    }));

    // валидируем ответ по shared
    const parsed = ArticleMetaSchema.array().parse(items);

    return {
      success: true,
      data: {
        items: parsed,
        total,
        page,
        limit,
        hasMore: skip + parsed.length < total,
      },
    };
  }

  async getById(id: string) {
    const row = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        status: true,
        mainCategoryId: true,
        categories: {
          select: { id: true, name: true, emoji: true, colors: true },
        },
      },
    });

    if (!row) throw new NotFoundException("Article not found");

    const dto: ArticleDTO = {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      mainCategory: row.mainCategoryId,
      categories: row.categories.map((c) => this.mapCategoryToShared(c)),
      content: row.content as any,
      status: row.status,
    };

    return { success: true, data: ArticleDTOSchema.parse(dto) };
  }

  private async getTestAuthorId() {
    if (this.testAuthorId) return this.testAuthorId;

    const user = await this.prisma.user.upsert({
      where: { username: "test-author" },
      create: {
        username: "test-author",
        firstname: "Test",
        lastname: "Author",
      },
      update: {},
      select: { id: true },
    });

    this.testAuthorId = user.id;
    return user.id;
  }

  private async getTestCategoryId() {
    if (this.testCategoryId) return this.testCategoryId;

    const category = await this.prisma.category.upsert({
      where: { name: "Test Category" },
      create: {
        name: "Test Category",
        emoji: "🧪",
        colors: {
          lightColor: "#f5f5f5",
          darkColor: "#1f1f1f",
          accentColor: "#ff6a00",
        },
      },
      update: {},
      select: { id: true },
    });

    this.testCategoryId = category.id;
    return category.id;
  }

  private async resolveCategoryIds(dto: CreateDto) {
    const ids = [dto.mainCategory, ...dto.categoryIds];
    const existing = await this.prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((c) => c.id));

    const fallbackId = await this.getTestCategoryId();
    const mainCategoryId = existingIds.has(dto.mainCategory)
      ? dto.mainCategory
      : fallbackId;

    const categoryIds = dto.categoryIds.filter((id) => existingIds.has(id));
    if (categoryIds.length === 0) categoryIds.push(fallbackId);

    return { mainCategoryId, categoryIds };
  }

  async create(dto: CreateDto) {
    const authorId = await this.getTestAuthorId();
    const { mainCategoryId, categoryIds } = await this.resolveCategoryIds(dto);

    const status = dto.status;
    const publishedAt = status === "published" ? new Date() : null;

    const created = await this.prisma.article.create({
      data: {
        title: dto.title,
        description: dto.description,
        content: dto.content as any,
        status,
        publishedAt,
        authorId,
        mainCategoryId,
        categories: { connect: categoryIds.map((id) => ({ id })) },
      },
      select: { id: true },
    });

    return { success: true, data: created };
  }

  async update(id: string, dto: UpdateDto) {
    const current = await this.prisma.article.findUnique({
      where: { id },
      select: { status: true, publishedAt: true },
    });
    if (!current) throw new NotFoundException("Article not found");

    const nextStatus = dto.status ? dto.status : undefined;

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.content !== undefined) data.content = dto.content as any;
    if (dto.mainCategory !== undefined) data.mainCategoryId = dto.mainCategory;
    if (nextStatus) data.status = nextStatus;

    if (dto.categoryIds !== undefined) {
      data.categories = { set: dto.categoryIds.map((cid) => ({ id: cid })) };
    }

    if (nextStatus === "published" && !current.publishedAt) data.publishedAt = new Date();
    if (nextStatus && nextStatus !== "published") data.publishedAt = null;

    const updated = await this.prisma.article.update({
      where: { id },
      data,
      select: { id: true },
    });

    return { success: true, data: updated };
  }
}
