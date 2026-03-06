import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ArticleContentResponse,
  ArticleContentResponseSchema,
  ArticleDTOSchema,
  ArticleListQuerySchema,
  ArticleListResponseSchema,
  ArticleMetaSchema,
  ArticleMetricsResponse,
  ArticleMetricsResponseSchema,
  ArticleResponseSchema,
  Content,
  CreateArticleResponseSchema,
  CreateArticleSchema,
  DislikeArticleResponseSchema,
  LikeArticleResponseSchema,
  UpdateArticleResponseSchema,
  UpdateArticleSchema,
  type ArticleListResponse,
  type ArticleResponse,
  type CreateArticleResponse,
  type UpdateArticleResponse,
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

  constructor(private readonly prisma: PrismaService) { }

  async list(query: ListQuery): Promise<ArticleListResponse> {
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

    return ArticleListResponseSchema.parse({
      success: true,
      data: {
        items: parsed,
        total,
        page,
        limit,
        hasMore: skip + parsed.length < total,
      },
    });
  }

  async getById(id: string): Promise<ArticleResponse> {
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

    return ArticleResponseSchema.parse({ success: true, data: ArticleDTOSchema.parse(dto) });
  }

  // TODO: посмотреть на SQL-инъекцию
  async getContentById(id: string): Promise<ArticleContentResponse> {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!article) throw new NotFoundException("Article not found");

    type ContentRow = {
      topic_id: string;
      topic_title: string;
      topic_order: number;
      page_id: string;
      page_order: number;
      page_topic_id: string;
      block_id: string | null;
      block_type: string | null;
      block_page_id: string | null;
      block_layout: unknown;
      paragraph_content: string | null;
      image_url: string | null;
      image_source: string | null;
      image_source_url: string | null;
      image_label: string | null;
      icon_name: string | null;
    };

    const rows = await this.prisma.$queryRaw<ContentRow[]>`
      SELECT
        t.id AS topic_id,
        t.title AS topic_title,
        t."order" AS topic_order,
        p.id AS page_id,
        p."order" AS page_order,
        p."topicId" AS page_topic_id,
        b.id AS block_id,
        b.type AS block_type,
        b."pageId" AS block_page_id,
        b.layout AS block_layout,
        bp.content AS paragraph_content,
        bi.url AS image_url,
        bi.source AS image_source,
        bi."sourceUrl" AS image_source_url,
        bi.label AS image_label,
        bk.name AS icon_name
      FROM topics t
      JOIN pages p ON p."topicId" = t.id
      LEFT JOIN blocks b ON b."pageId" = p.id
      LEFT JOIN blocks_paragraph bp ON bp.id = b.id AND b.type = 'paragraph'
      LEFT JOIN blocks_image bi ON bi.id = b.id AND b.type = 'image'
      LEFT JOIN blocks_icon bk ON bk.id = b.id AND b.type = 'icon'
      WHERE t."articleId" = ${id}
      ORDER BY t."order", p."order", b.id
    `;

    const topicsMap = new Map<string, Content["topics"][number]>();
    const pagesMap = new Map<string, Content["pages"][number]>();
    const blocksMap = new Map<string, Content["blocks"][number]>();

    for (const row of rows) {
      let topic = topicsMap.get(row.topic_id);
      if (!topic) {
        topic = {
          id: row.topic_id,
          articleId: id,
          title: row.topic_title,
          order: row.topic_order,
        };
        topicsMap.set(row.topic_id, topic);
      }

      let page = pagesMap.get(row.page_id);
      if (!page) {
        page = {
          id: row.page_id,
          topicId: row.page_topic_id,
          order: row.page_order,
        };
        pagesMap.set(row.page_id, page);
      }

      if (row.block_id && row.block_type && row.block_page_id && !blocksMap.has(row.block_id)) {
        const baseBlock = {
          id: row.block_id,
          type: row.block_type,
          pageId: row.block_page_id,
          layout: this.normalizeLayout(row.block_layout, row.block_id),
          object3d: null,
        };

        if (row.block_type === "paragraph") {
          blocksMap.set(row.block_id, {
            ...baseBlock,
            type: "paragraph",
            content: row.paragraph_content ?? "",
          });
        } else if (row.block_type === "image") {
          blocksMap.set(row.block_id, {
            ...baseBlock,
            type: "image",
            url: row.image_url ?? "https://picsum.photos/seed/fallback/1200/800",
            source: row.image_source,
            sourceUrl: row.image_source_url,
            label: row.image_label,
          });
        } else if (row.block_type === "icon") {
          blocksMap.set(row.block_id, {
            ...baseBlock,
            type: "icon",
            name: row.icon_name ?? "FaRegCircle",
          });
        }
      }
    }

    const content: Content = {
      articleId: id,
      topics: Array.from(topicsMap.values()).sort((a, b) => a.order - b.order),
      pages: Array.from(pagesMap.values()).sort((a, b) => a.order - b.order),
      blocks: Array.from(blocksMap.values()),
    };

    return ArticleContentResponseSchema.parse({
      success: true,
      data: content,
    });
  }

  async getMetricsById(id: string, userId: string | undefined): Promise<ArticleMetricsResponse> {
    const { views, likes, saves, reposts, userMetric } = await this.prisma.$transaction(async (tx) => {
      const article = await tx.article.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!article) throw new NotFoundException("Article not found");

      const viewsPromise = tx.userArticleMetric.count({
        where: { articleId: id },
      });
      const likesPromise = tx.userArticleMetric.count({
        where: { articleId: id, liked: true },
      });
      const savesPromise = tx.userArticleMetric.count({
        where: { articleId: id, saved: true },
      });
      const repostsPromise = tx.userArticleMetric.count({
        where: { articleId: id, reposted: true },
      });
      const userMetricPromise = userId
        ? tx.userArticleMetric.findUnique({
          where: {
            userId_articleId: {
              userId,
              articleId: id,
            },
          },
          select: {
            liked: true,
            saved: true,
            reposted: true,
          },
        })
        : Promise.resolve(null);

      const [views, likes, saves, reposts, userMetric] = await Promise.all([
        viewsPromise,
        likesPromise,
        savesPromise,
        repostsPromise,
        userMetricPromise,
      ]);

      return { views, likes, saves, reposts, userMetric };
    });

    return ArticleMetricsResponseSchema.parse({
      success: true,
      data: {
        views,
        likes,
        saves,
        reposts,
        comments: 0,
        liked: userMetric?.liked ?? false,
        saved: userMetric?.saved ?? false,
        reposted: userMetric?.reposted ?? false,
      },
    });
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

  async create(dto: CreateDto): Promise<CreateArticleResponse> {
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

      await this.persistStructuredContent(tx, article.id, dto.content);

      return {
        ...article,
        categories: article.categories.map((c) => c.id),
      };
    });

    return CreateArticleResponseSchema.parse({ success: true, data: created });
  }

  async update(id: string, dto: UpdateDto): Promise<UpdateArticleResponse> {
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

    return UpdateArticleResponseSchema.parse({
      success: true,
      data: {
        ...updated,
        categories: updated.categories.map((c) => c.id),
      },
    });
  }

  async likeArticle(articleId: string, userId: string) {
    return this.setReaction(articleId, userId, "like");
  }

  async unlikeArticle(articleId: string, userId: string) {
    return this.clearReaction(articleId, userId, "like");
  }

  async dislikeArticle(articleId: string, userId: string) {
    return this.setReaction(articleId, userId, "dislike");
  }

  async undislikeArticle(articleId: string, userId: string) {
    return this.clearReaction(articleId, userId, "dislike");
  }

  async saveArticle(articleId: string, userId: string): Promise<ArticleMetricsResponse> {
    await this.setMetricFlag(articleId, userId, "saved", true);
    return this.getMetricsById(articleId, userId);
  }

  async unsaveArticle(articleId: string, userId: string): Promise<ArticleMetricsResponse> {
    await this.setMetricFlag(articleId, userId, "saved", false);
    return this.getMetricsById(articleId, userId);
  }

  async repostArticle(articleId: string, userId: string): Promise<ArticleMetricsResponse> {
    await this.setMetricFlag(articleId, userId, "reposted", true);
    return this.getMetricsById(articleId, userId);
  }

  async unrepostArticle(articleId: string, userId: string): Promise<ArticleMetricsResponse> {
    await this.setMetricFlag(articleId, userId, "reposted", false);
    return this.getMetricsById(articleId, userId);
  }

  private async setReaction(articleId: string, userId: string, reaction: "like" | "dislike") {
    await this.ensureArticleExists(articleId);

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

    const payload = { success: true, data: metric };
    return reaction === "like"
      ? LikeArticleResponseSchema.parse(payload)
      : DislikeArticleResponseSchema.parse(payload);
  }

  private async clearReaction(articleId: string, userId: string, reaction: "like" | "dislike") {
    await this.ensureArticleExists(articleId);

    await this.prisma.userArticleMetric.updateMany({
      where: {
        userId,
        articleId,
      },
      data: {
        liked: reaction === "like" ? false : undefined,
        disliked: reaction === "dislike" ? false : undefined,
        updatedAt: new Date(),
      },
    });

    const metric = await this.prisma.userArticleMetric.findUnique({
      where: {
        userId_articleId: {
          userId,
          articleId,
        },
      },
      select: {
        liked: true,
        disliked: true,
      },
    });

    const payload = {
      success: true,
      data: {
        articleId,
        liked: metric?.liked ?? false,
        disliked: metric?.disliked ?? false,
      },
    };

    return reaction === "like"
      ? LikeArticleResponseSchema.parse(payload)
      : DislikeArticleResponseSchema.parse(payload);
  }

  private async setMetricFlag(articleId: string, userId: string, flag: "saved" | "reposted", value: boolean) {
    await this.ensureArticleExists(articleId);

    if (value) {
      await this.prisma.userArticleMetric.upsert({
        where: {
          userId_articleId: {
            userId,
            articleId,
          },
        },
        update: {
          [flag]: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          articleId,
          focusTime: 0,
          viewedPages: 0,
          liked: false,
          disliked: false,
          saved: flag === "saved",
          subscribed: false,
          reposted: flag === "reposted",
          updatedAt: new Date(),
        },
      });
      return;
    }

    await this.prisma.userArticleMetric.updateMany({
      where: {
        userId,
        articleId,
      },
      data: {
        [flag]: false,
        updatedAt: new Date(),
      },
    });
  }

  private async ensureArticleExists(articleId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true },
    });
    if (!article) throw new NotFoundException("Article not found");
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

  private normalizeLayout(value: unknown, blockId: string) {
    const fallback = { i: blockId, x: 0, y: 0, w: 2, h: 2 };
    if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

    const layout = value as Record<string, unknown>;
    const asInt = (v: unknown, d: number) => (typeof v === "number" && Number.isInteger(v) ? v : d);

    return {
      i: typeof layout.i === "string" ? layout.i : blockId,
      x: asInt(layout.x, 0),
      y: asInt(layout.y, 0),
      w: asInt(layout.w, 2),
      h: asInt(layout.h, 2),
    };
  }

}
