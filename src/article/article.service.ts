import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
  CreateEmptyDraftResponseSchema,
  DislikeArticleResponseSchema,
  LikeArticleResponseSchema,
  UpdateArticleResponseSchema,
  UpdateArticleSchema,
  type ArticleListResponse,
  type ArticleResponse,
  type CreateEmptyDraftResponse,
  type UpdateArticleResponse,
} from "@smth/shared";
import type { z } from "zod";
import { INTERNAL_DRAFT_CATEGORY_NAME } from "../common/constants/internal-category.constants";
import { PrismaService } from "../prisma/prisma.service";
import { ArticleContentService } from "./article-content.service";

type UpdateDto = z.infer<typeof UpdateArticleSchema>;
type ListQuery = z.infer<typeof ArticleListQuerySchema>;
type DeleteArticleResponse = { success: true; data: { id: string } };

@Injectable()
export class ArticleService {
  private static readonly MAX_DRAFTS_PER_USER = 10;
  private testCategoryId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly articleContentService: ArticleContentService,
  ) { }

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
    const content = await this.articleContentService.buildContentByArticleId(id);

    const dto = {
      id: row.id,
      title: row.title,
      description: row.description,
      content,
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
    const content = await this.articleContentService.buildContentByArticleId(id);

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

  private async getTestCategoryId() {
    if (this.testCategoryId) return this.testCategoryId;

    const category = await this.prisma.category.upsert({
      where: { name: INTERNAL_DRAFT_CATEGORY_NAME },
      create: {
        name: INTERNAL_DRAFT_CATEGORY_NAME,
        emoji: "_",
        colors: {
          lightColor: "#f3f4f6",
          darkColor: "#111827",
          accentColor: "#9ca3af",
        },
      },
      update: {},
      select: { id: true },
    });

    this.testCategoryId = category.id;
    return category.id;
  }

  async createEmptyDraft(authorId: string): Promise<CreateEmptyDraftResponse> {
    const draftsCount = await this.prisma.article.count({
      where: {
        authorId,
        status: "draft",
      },
    });
    if (draftsCount >= ArticleService.MAX_DRAFTS_PER_USER) {
      throw new BadRequestException(`Draft limit reached (${ArticleService.MAX_DRAFTS_PER_USER})`);
    }

    const mainCategoryId = await this.getTestCategoryId();

    const created = await this.prisma.$transaction(async (tx) => {
      const article = await tx.article.create({
        data: {
          title: "",
          description: null,
          content: {},
          authorId,
          mainCategoryId,
          status: "draft",
          publishedAt: null,
          categories: { connect: [{ id: mainCategoryId }] },
        },
        select: { id: true },
      });

      return article;
    });

    return CreateEmptyDraftResponseSchema.parse({
      success: true,
      data: { id: created.id },
    });
  }

  async deleteByIdForAuthor(id: string, authorId: string): Promise<DeleteArticleResponse> {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true, authorId: true, status: true },
    });
    if (!article) throw new NotFoundException("Article not found");
    if (article.authorId !== authorId) throw new ForbiddenException("You can delete only your own article");
    if (article.status !== "draft" && article.status !== "review") {
      throw new BadRequestException("Only draft or review articles can be deleted here");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userArticleMetric.deleteMany({ where: { articleId: id } });
      await tx.userFeed.deleteMany({ where: { articleId: id } });
      await this.deleteStructuredContent(tx, id);
      await tx.article.delete({ where: { id } });
    });

    return { success: true, data: { id } };
  }

  async saveDraftById(id: string, authorId: string, dto: UpdateDto): Promise<UpdateArticleResponse> {
    return this.updateDraftStatusById(id, authorId, dto, "draft");
  }

  async submitForReviewById(id: string, authorId: string, dto: UpdateDto): Promise<UpdateArticleResponse> {
    return this.updateDraftStatusById(id, authorId, dto, "review");
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

  private async updateDraftStatusById(
    id: string,
    authorId: string,
    dto: UpdateDto,
    status: "draft" | "review",
  ): Promise<UpdateArticleResponse> {
    const existing = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        title: true,
        mainCategoryId: true,
        categories: { select: { id: true } },
      },
    });
    if (!existing) throw new NotFoundException("Article not found");
    if (existing.authorId !== authorId) throw new ForbiddenException("You can edit only your own article");

    const fallbackCategoryId = await this.getTestCategoryId();
    const nextTitle = dto.title !== undefined ? dto.title : existing.title;
    const nextMainCategoryId = dto.mainCategoryId !== undefined
      ? await this.resolveMainCategoryId(dto.mainCategoryId)
      : existing.mainCategoryId;

    if (status === "review") {
      if (!nextTitle.trim()) {
        throw new BadRequestException("Title is required before sending to review");
      }
      if (nextMainCategoryId === fallbackCategoryId) {
        throw new BadRequestException("Main category is required before sending to review");
      }
    }

    const data: any = {
      status,
      publishedAt: null,
    };
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.mainCategoryId !== undefined) data.mainCategoryId = nextMainCategoryId;
    if (dto.categoryIds !== undefined || status === "review") {
      const incomingCategoryIds = dto.categoryIds ?? existing.categories.map((c) => c.id);
      const filteredCategoryIds =
        status === "review"
          ? incomingCategoryIds.filter((cid) => cid !== fallbackCategoryId)
          : incomingCategoryIds;
      const withMain = filteredCategoryIds.includes(nextMainCategoryId)
        ? filteredCategoryIds
        : [...filteredCategoryIds, nextMainCategoryId];
      data.categories = { set: withMain.map((cid) => ({ id: cid })) };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const article = await tx.article.update({
        where: { id },
        data,
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

      if (dto.content !== undefined) {
        await this.deleteStructuredContent(tx, id);
        await this.persistStructuredContent(tx, id, dto.content);
      }

      return article;
    });
    const content = await this.articleContentService.buildContentByArticleId(id);

    return UpdateArticleResponseSchema.parse({
      success: true,
      data: {
        ...updated,
        content,
        categories: updated.categories.map((c) => c.id),
      },
    });
  }

  private async deleteStructuredContent(tx: any, articleId: string) {
    await tx.blockParagraph.deleteMany({
      where: {
        block: {
          page: {
            topic: {
              articleId,
            },
          },
        },
      },
    });
    await tx.blockImage.deleteMany({
      where: {
        block: {
          page: {
            topic: {
              articleId,
            },
          },
        },
      },
    });
    await tx.blockIcon.deleteMany({
      where: {
        block: {
          page: {
            topic: {
              articleId,
            },
          },
        },
      },
    });
    await tx.block.deleteMany({
      where: {
        page: {
          topic: {
            articleId,
          },
        },
      },
    });
    await tx.page.deleteMany({
      where: {
        topic: {
          articleId,
        },
      },
    });
    await tx.topic.deleteMany({
      where: { articleId },
    });
  }

  private async resolveMainCategoryId(mainCategoryId: string | null): Promise<string> {
    const fallbackId = await this.getTestCategoryId();
    if (!mainCategoryId) return fallbackId;

    const existing = await this.prisma.category.findUnique({
      where: { id: mainCategoryId },
      select: { id: true },
    });

    return existing ? existing.id : fallbackId;
  }

  private async persistStructuredContent(tx: any, articleId: string, content: unknown) {
    const contentObj = this.asRecord(content);
    if (!contentObj) return;

    const topics = Array.isArray(contentObj.topics) ? contentObj.topics : [];
    const pages = Array.isArray(contentObj.pages) ? contentObj.pages : [];
    const blocks = Array.isArray(contentObj.blocks) ? contentObj.blocks : [];

    // Shared ContentSchema stores topics/pages/blocks as flat arrays.
    if (pages.length > 0 || blocks.length > 0) {
      for (let tIndex = 0; tIndex < topics.length; tIndex += 1) {
        const topicObj = this.asRecord(topics[tIndex]);
        if (!topicObj) continue;

        const topicId = this.asNonEmptyString(topicObj.id);
        if (!topicId) {
          throw new BadRequestException(`Invalid topic id at index ${tIndex}`);
        }

        await tx.topic.create({
          data: {
            id: topicId,
            articleId,
            title: typeof topicObj.title === "string" && topicObj.title.trim() ? topicObj.title : "Untitled topic",
            order: this.toInt(topicObj.order, tIndex + 1),
          },
        });
      }

      for (let pIndex = 0; pIndex < pages.length; pIndex += 1) {
        const pageObj = this.asRecord(pages[pIndex]);
        if (!pageObj) continue;

        const pageId = this.asNonEmptyString(pageObj.id);
        const topicId = this.asNonEmptyString(pageObj.topicId);
        if (!pageId || !topicId) {
          throw new BadRequestException(`Invalid page at index ${pIndex}`);
        }

        await tx.page.create({
          data: {
            id: pageId,
            topicId,
            order: this.toInt(pageObj.order, pIndex),
          },
        });
      }

      for (let bIndex = 0; bIndex < blocks.length; bIndex += 1) {
        const blockObj = this.asRecord(blocks[bIndex]);
        if (!blockObj) continue;

        const blockId = this.asNonEmptyString(blockObj.id);
        const pageId = this.asNonEmptyString(blockObj.pageId);
        const type = this.asNonEmptyString(blockObj.type);
        if (!blockId || !pageId || !type) {
          throw new BadRequestException(`Invalid block at index ${bIndex}`);
        }

        await tx.block.create({
          data: {
            id: blockId,
            pageId,
            type,
            layout: this.toJsonNullable(blockObj.layout),
          },
        });

        if (type === "paragraph") {
          const paragraphContent =
            typeof blockObj.content === "string"
              ? blockObj.content
              : JSON.stringify(blockObj.content ?? "");
          await tx.blockParagraph.create({
            data: {
              id: blockId,
              content: paragraphContent,
            },
          });
          continue;
        }

        if (type === "image") {
          const url = this.asNonEmptyString(blockObj.url);
          if (!url) throw new BadRequestException(`Invalid image block at index ${bIndex}`);

          await tx.blockImage.create({
            data: {
              id: blockId,
              url,
              source: typeof blockObj.source === "string" ? blockObj.source : null,
              sourceUrl: typeof blockObj.sourceUrl === "string" ? blockObj.sourceUrl : null,
              label: typeof blockObj.label === "string" ? blockObj.label : null,
            },
          });
          continue;
        }

        if (type === "icon") {
          const name = this.asNonEmptyString(blockObj.name);
          if (!name) throw new BadRequestException(`Invalid icon block at index ${bIndex}`);

          await tx.blockIcon.create({
            data: {
              id: blockId,
              name,
            },
          });
          continue;
        }

        throw new BadRequestException(`Unsupported block type "${type}" at index ${bIndex}`);
      }

      return;
    }

    // Backward compatibility for legacy nested shape: topics[].pages[].blocks[].
    for (let tIndex = 0; tIndex < topics.length; tIndex += 1) {
      const topicObj = this.asRecord(topics[tIndex]);
      if (!topicObj) continue;

      const createdTopic = await tx.topic.create({
        data: {
          articleId,
          title: typeof topicObj.title === "string" && topicObj.title.trim() ? topicObj.title : "Untitled topic",
          order: this.toInt(topicObj.order, tIndex + 1),
        },
        select: { id: true },
      });

      const nestedPages = Array.isArray(topicObj.pages) ? topicObj.pages : [];
      for (let pIndex = 0; pIndex < nestedPages.length; pIndex += 1) {
        const pageObj = this.asRecord(nestedPages[pIndex]);
        if (!pageObj) continue;

        const createdPage = await tx.page.create({
          data: {
            topicId: createdTopic.id,
            order: this.toInt(pageObj.order, pIndex),
          },
          select: { id: true },
        });

        const nestedBlocks = Array.isArray(pageObj.blocks) ? pageObj.blocks : [];
        for (let bIndex = 0; bIndex < nestedBlocks.length; bIndex += 1) {
          const blockObj = this.asRecord(nestedBlocks[bIndex]);
          if (!blockObj) continue;

          const type = this.asNonEmptyString(blockObj.type) ?? "paragraph";
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
            const url = this.asNonEmptyString(blockObj.url);
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
            const name = this.asNonEmptyString(blockObj.name);
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

  private asNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private toJsonNullable(value: unknown) {
    if (value === undefined) return null;
    return value as any;
  }

}
