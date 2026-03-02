import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ArticleDTOSchema,
  ArticleListQuerySchema,
  ArticleMetaSchema,
  CreateArticleSchema,
  UpdateArticleSchema,
} from "@smth/shared";
import type { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

type CreateDto = z.infer<typeof CreateArticleSchema>;
type UpdateDto = z.infer<typeof UpdateArticleSchema>;
type ListQuery = z.infer<typeof ArticleListQuerySchema>;

@Injectable()
export class ArticleService {
  private testAuthorId: string | null = null;
  private testCategoryId: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListQuery) {
    const { page, limit, status, mainCategoryId, authorId, search } = query;

    const where: any = {};

    if (status) where.status = status;
    if (authorId) where.authorId = authorId;

    if (mainCategoryId) {
      where.OR = [{ mainCategoryId }, { categories: { some: { id: mainCategoryId } } }];
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
          authorId: true,
          status: true,
          mainCategoryId: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          categories: { select: { id: true } },
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    const items = rows.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      authorId: a.authorId,
      mainCategoryId: a.mainCategoryId,
      categories: a.categories.map((c) => c.id),
      status: a.status,
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

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
        authorId: true,
        mainCategoryId: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        categories: { select: { id: true } },
      },
    });

    if (!row) throw new NotFoundException("Article not found");

    const dto = {
      id: row.id,
      title: row.title,
      description: row.description,
      content: row.content as any,
      authorId: row.authorId,
      mainCategoryId: row.mainCategoryId,
      status: row.status,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      categories: row.categories.map((c) => c.id),
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
        emoji: "??",
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
    const categoryIdsInput = dto.categoryIds ?? [];
    const ids = [dto.mainCategoryId, ...categoryIdsInput];
    const existing = await this.prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((c) => c.id));

    const fallbackId = await this.getTestCategoryId();
    const mainCategoryId = existingIds.has(dto.mainCategoryId) ? dto.mainCategoryId : fallbackId;

    const categoryIds = categoryIdsInput.filter((id) => existingIds.has(id));
    if (categoryIds.length === 0) categoryIds.push(fallbackId);

    return { mainCategoryId, categoryIds };
  }

  async create(dto: CreateDto) {
    const authorId = dto.authorId ?? (await this.getTestAuthorId());
    const { mainCategoryId, categoryIds } = await this.resolveCategoryIds(dto);

    const status = dto.status;
    const publishedAt = status === "published" ? new Date() : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const article = await tx.article.create({
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

      await this.persistStructuredContent(tx, article.id, dto.content);

      return article;
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
    if (dto.mainCategoryId !== undefined) data.mainCategoryId = dto.mainCategoryId;
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

  async likeArticle(articleId: string, userId: string) {
    return this.setReaction(articleId, userId, "like");
  }

  async dislikeArticle(articleId: string, userId: string) {
    return this.setReaction(articleId, userId, "dislike");
  }

  private async setReaction(articleId: string, userId: string, reaction: "like" | "dislike") {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true },
    });
    if (!article) throw new NotFoundException("Article not found");

    const liked = reaction === "like";
    const disliked = reaction === "dislike";

    const metric = await this.prisma.userArticleMetric.upsert({
      where: {
        userId_articleId: {
          userId,
          articleId,
        },
      },
      update: {
        liked,
        disliked,
        updatedAt: new Date(),
      },
      create: {
        userId,
        articleId,
        focusTime: 0,
        viewedPages: 0,
        liked,
        disliked,
        saved: false,
        subscribed: false,
        reposted: false,
        updatedAt: new Date(),
      },
      select: {
        articleId: true,
        liked: true,
        disliked: true,
      },
    });

    return { success: true, data: metric };
  }

  private async persistStructuredContent(tx: any, articleId: string, content: unknown) {
    const contentObj = this.asRecord(content);
    if (!contentObj) return;

    const topics = Array.isArray(contentObj.topics) ? contentObj.topics : [];
    for (let tIndex = 0; tIndex < topics.length; tIndex += 1) {
      const topicObj = this.asRecord(topics[tIndex]);
      if (!topicObj) continue;

      const createdTopic = await tx.topic.create({
        data: {
          articleId,
          title: typeof topicObj.title === "string" && topicObj.title.trim() ? topicObj.title : "Untitled topic",
          order: this.toInt(topicObj.order, tIndex),
        },
        select: { id: true },
      });

      const pages = Array.isArray(topicObj.pages) ? topicObj.pages : [];
      for (let pIndex = 0; pIndex < pages.length; pIndex += 1) {
        const pageObj = this.asRecord(pages[pIndex]);
        if (!pageObj) continue;

        const createdPage = await tx.page.create({
          data: {
            topicId: createdTopic.id,
            order: this.toInt(pageObj.order, pIndex),
          },
          select: { id: true },
        });

        const blocks = Array.isArray(pageObj.blocks) ? pageObj.blocks : [];
        for (let bIndex = 0; bIndex < blocks.length; bIndex += 1) {
          const blockObj = this.asRecord(blocks[bIndex]);
          if (!blockObj) continue;

          const type = typeof blockObj.type === "string" && blockObj.type.trim() ? blockObj.type : "paragraph";
          const createdBlock = await tx.block.create({
            data: {
              pageId: createdPage.id,
              type,
              layout: this.toJsonNullable(blockObj.layout),
            },
            select: { id: true },
          });

          if (type === "paragraph") {
            const paragraphContent =
              typeof blockObj.content === "string"
                ? blockObj.content
                : JSON.stringify(blockObj.content ?? "");
            await tx.blockParagraph.create({
              data: {
                id: createdBlock.id,
                content: paragraphContent,
              },
            });
            continue;
          }

          if (type === "image") {
            const url = typeof blockObj.url === "string" ? blockObj.url.trim() : "";
            if (!url) {
              throw new BadRequestException(`Invalid image block at topic ${tIndex}, page ${pIndex}, block ${bIndex}`);
            }
            await tx.blockImage.create({
              data: {
                id: createdBlock.id,
                url,
                source: typeof blockObj.source === "string" ? blockObj.source : null,
                sourceUrl: typeof blockObj.sourceUrl === "string" ? blockObj.sourceUrl : null,
                label: typeof blockObj.label === "string" ? blockObj.label : null,
              },
            });
            continue;
          }

          if (type === "icon") {
            const name = typeof blockObj.name === "string" ? blockObj.name.trim() : "";
            if (!name) {
              throw new BadRequestException(`Invalid icon block at topic ${tIndex}, page ${pIndex}, block ${bIndex}`);
            }
            await tx.blockIcon.create({
              data: {
                id: createdBlock.id,
                name,
              },
            });
          }
        }
      }
    }
  }

  private toInt(value: unknown, fallback: number) {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isInteger(parsed)) return parsed;
    }
    return fallback;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private toJsonNullable(value: unknown) {
    if (value === undefined) return null;
    return value as any;
  }
}
