import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
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

  async create(dto: CreateDto) {
    const authorId =
      process.env.DEFAULT_AUTHOR_ID ??
      (await this.prisma.user.findFirst({ select: { id: true } }))?.id;

    if (!authorId) {
      throw new InternalServerErrorException("No authorId available (set DEFAULT_AUTHOR_ID or create a user)");
    }

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
        mainCategoryId: dto.mainCategory,
        categories: { connect: dto.categoryIds.map((id) => ({ id })) },
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
