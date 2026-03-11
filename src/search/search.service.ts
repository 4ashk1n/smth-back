import { Injectable, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  SearchArticlesQuerySchema,
  SearchArticlesResponseSchema,
  SearchCategoriesQuerySchema,
  SearchCategoriesResponseSchema,
  SearchUsersQuerySchema,
  SearchUsersResponseSchema,
  type SearchArticlesResponse,
  type SearchCategoriesResponse,
  type SearchUsersResponse,
} from "@smth/shared";
import type { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

type SearchUsersQuery = z.infer<typeof SearchUsersQuerySchema>;
type SearchArticlesQuery = z.infer<typeof SearchArticlesQuerySchema>;
type SearchCategoriesQuery = z.infer<typeof SearchCategoriesQuerySchema>;

type UserSearchRow = {
  id: string;
  username: string;
  firstname: string;
  lastname: string;
  avatar: string;
  score: number;
  total_count: number;
};

type ArticleSearchRow = {
  id: string;
  title: string;
  description: string | null;
  authorId: string;
  mainCategoryId: string;
  categories: string[];
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  score: number;
  total_count: number;
};

type CategorySearchRow = {
  id: string;
  name: string;
  emoji: string;
  colors: unknown;
  createdAt: Date;
  updatedAt: Date;
  score: number;
  total_count: number;
};

@Injectable()
export class SearchService implements OnModuleInit {
  private hasPgTrgm = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const rows = await this.prisma.$queryRaw<Array<{ hasPgTrgm: boolean }>>(
      Prisma.sql`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS "hasPgTrgm"`,
    );
    this.hasPgTrgm = rows[0]?.hasPgTrgm ?? false;
  }

  async searchUsers(query: SearchUsersQuery): Promise<SearchUsersResponse> {
    const q = query.q.trim();
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const userSimilarityScore = this.hasPgTrgm
      ? Prisma.sql`
          GREATEST(
            similarity(lower(u.username), lower(${q})),
            similarity(lower(coalesce(u.firstname, '') || ' ' || coalesce(u.lastname, '')), lower(${q}))
          ) * 20
        `
      : Prisma.sql`0`;
    const userSimilarityWhere = this.hasPgTrgm
      ? Prisma.sql`
          OR similarity(lower(u.username), lower(${q})) >= 0.2
          OR similarity(lower(coalesce(u.firstname, '') || ' ' || coalesce(u.lastname, '')), lower(${q})) >= 0.2
        `
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<UserSearchRow[]>(Prisma.sql`
      WITH matched AS (
        SELECT
          u.id,
          u.username,
          u.firstname,
          u.lastname,
          u.avatar,
          (
            CASE WHEN u.id = ${q} THEN 120 ELSE 0 END +
            CASE WHEN lower(u.username) = lower(${q}) THEN 100 ELSE 0 END +
            ts_rank_cd(
              to_tsvector('simple', coalesce(u.username, '') || ' ' || coalesce(u.firstname, '') || ' ' || coalesce(u.lastname, '')),
              websearch_to_tsquery('simple', ${q})
            ) * 40 +
            ${userSimilarityScore}
          ) AS score
        FROM users u
        WHERE
          u.id = ${q}
          OR lower(u.username) = lower(${q})
          OR to_tsvector('simple', coalesce(u.username, '') || ' ' || coalesce(u.firstname, '') || ' ' || coalesce(u.lastname, ''))
             @@ websearch_to_tsquery('simple', ${q})
          ${userSimilarityWhere}
      )
      SELECT
        id,
        username,
        firstname,
        lastname,
        avatar,
        score,
        COUNT(*) OVER()::int AS total_count
      FROM matched
      ORDER BY score DESC, username ASC
      LIMIT ${limit}
      OFFSET ${skip}
    `);

    const total = rows[0]?.total_count ?? 0;

    return SearchUsersResponseSchema.parse({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          username: row.username,
          firstname: row.firstname,
          lastname: row.lastname,
          avatar: row.avatar,
          // score: row.score,
        })),
        total,
        page,
        limit,
        hasMore: skip + rows.length < total,
      },
    });
  }

  async searchArticles(query: SearchArticlesQuery): Promise<SearchArticlesResponse> {
    const q = query.q.trim();
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const categoryIds = (query.categoryIds ?? []).filter((id) => id.trim().length > 0);

    const categoryFilter = categoryIds.length > 0
      ? Prisma.sql`
          AND (
            a."mainCategoryId" IN (${Prisma.join(categoryIds)})
            OR EXISTS (
              SELECT 1
              FROM "_ArticleCategories" acf
              WHERE acf."A" = a.id
                AND acf."B" IN (${Prisma.join(categoryIds)})
            )
          )
        `
      : Prisma.empty;
    const categoryNameSimilarityMain = this.hasPgTrgm
      ? Prisma.sql`OR similarity(lower(cm.name), lower(${q})) >= 0.2`
      : Prisma.empty;
    const categoryNameSimilarityJoin = this.hasPgTrgm
      ? Prisma.sql`OR similarity(lower(c.name), lower(${q})) >= 0.2`
      : Prisma.empty;
    const articleSimilarityScore = this.hasPgTrgm
      ? Prisma.sql`
          GREATEST(
            similarity(lower(b.title), lower(${q})),
            similarity(lower(coalesce(b.description, '')), lower(${q}))
          ) * 20
        `
      : Prisma.sql`0`;
    const articleSimilarityWhere = this.hasPgTrgm
      ? Prisma.sql`
          OR similarity(lower(b.title), lower(${q})) >= 0.2
          OR similarity(lower(coalesce(b.description, '')), lower(${q})) >= 0.2
        `
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ArticleSearchRow[]>(Prisma.sql`
      WITH base AS (
        SELECT
          a.id,
          a.title,
          a.description,
          a."authorId",
          a."mainCategoryId",
          lower(a.status::text) AS status,
          a."publishedAt",
          a."createdAt",
          a."updatedAt",
          COALESCE(array_agg(DISTINCT ac."B") FILTER (WHERE ac."B" IS NOT NULL), ARRAY[]::text[]) AS categories,
          EXISTS (
            SELECT 1
            FROM categories cm
            WHERE cm.id = a."mainCategoryId"
              AND (
                cm.id = ${q}
                OR lower(cm.name) = lower(${q})
                OR to_tsvector('simple', coalesce(cm.name, '')) @@ websearch_to_tsquery('simple', ${q})
                ${categoryNameSimilarityMain}
              )
          )
          OR EXISTS (
            SELECT 1
            FROM "_ArticleCategories" acm
            JOIN categories c ON c.id = acm."B"
            WHERE acm."A" = a.id
              AND (
                c.id = ${q}
                OR lower(c.name) = lower(${q})
                OR to_tsvector('simple', coalesce(c.name, '')) @@ websearch_to_tsquery('simple', ${q})
                ${categoryNameSimilarityJoin}
              )
          ) AS category_match,
          EXISTS (
            SELECT 1
            FROM categories cm2
            WHERE cm2.id = a."mainCategoryId"
              AND cm2.id = ${q}
          )
          OR EXISTS (
            SELECT 1
            FROM "_ArticleCategories" acm2
            WHERE acm2."A" = a.id
              AND acm2."B" = ${q}
          ) AS category_id_exact
        FROM articles a
        LEFT JOIN "_ArticleCategories" ac ON ac."A" = a.id
        WHERE a.status = 'published'::"ArticleStatus"
        ${categoryFilter}
        GROUP BY a.id
      ),
      matched AS (
        SELECT
          b.*,
          (
            CASE WHEN b.id = ${q} THEN 120 ELSE 0 END +
            CASE WHEN lower(b.title) = lower(${q}) THEN 60 ELSE 0 END +
            ts_rank_cd(
              to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.description, '')),
              websearch_to_tsquery('simple', ${q})
            ) * 40 +
            ${articleSimilarityScore} +
            CASE WHEN b.category_match THEN 15 ELSE 0 END +
            CASE WHEN b.category_id_exact THEN 40 ELSE 0 END
          ) AS score
        FROM base b
        WHERE
          b.id = ${q}
          OR lower(b.title) = lower(${q})
          OR to_tsvector('simple', coalesce(b.title, '') || ' ' || coalesce(b.description, ''))
             @@ websearch_to_tsquery('simple', ${q})
          ${articleSimilarityWhere}
          OR b.category_match
          OR b.category_id_exact
      )
      SELECT
        id,
        title,
        description,
        "authorId",
        "mainCategoryId",
        categories,
        status,
        "publishedAt",
        "createdAt",
        "updatedAt",
        score,
        COUNT(*) OVER()::int AS total_count
      FROM matched
      ORDER BY score DESC, "publishedAt" DESC NULLS LAST, "createdAt" DESC
      LIMIT ${limit}
      OFFSET ${skip}
    `);

    const total = rows[0]?.total_count ?? 0;

    return SearchArticlesResponseSchema.parse({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          authorId: row.authorId,
          mainCategoryId: row.mainCategoryId,
          categories: row.categories,
          status: "published",
          publishedAt: row.publishedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          // score: row.score,
        })),
        total,
        page,
        limit,
        hasMore: skip + rows.length < total,
      },
    });
  }

  async searchCategories(query: SearchCategoriesQuery): Promise<SearchCategoriesResponse> {
    const q = query.q.trim();
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const categorySimilarityScore = this.hasPgTrgm
      ? Prisma.sql`similarity(lower(c.name), lower(${q})) * 20`
      : Prisma.sql`0`;
    const categorySimilarityWhere = this.hasPgTrgm
      ? Prisma.sql`OR similarity(lower(c.name), lower(${q})) >= 0.2`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<CategorySearchRow[]>(Prisma.sql`
      WITH matched AS (
        SELECT
          c.id,
          c.name,
          c.emoji,
          c.colors,
          c."createdAt",
          c."updatedAt",
          (
            CASE WHEN c.id = ${q} THEN 120 ELSE 0 END +
            CASE WHEN lower(c.name) = lower(${q}) THEN 100 ELSE 0 END +
            ts_rank_cd(
              to_tsvector('simple', coalesce(c.name, '')),
              websearch_to_tsquery('simple', ${q})
            ) * 40 +
            ${categorySimilarityScore}
          ) AS score
        FROM categories c
        WHERE
          c.id = ${q}
          OR lower(c.name) = lower(${q})
          OR to_tsvector('simple', coalesce(c.name, '')) @@ websearch_to_tsquery('simple', ${q})
          ${categorySimilarityWhere}
      )
      SELECT
        id,
        name,
        emoji,
        colors,
        "createdAt",
        "updatedAt",
        score,
        COUNT(*) OVER()::int AS total_count
      FROM matched
      ORDER BY score DESC, name ASC
      LIMIT ${limit}
      OFFSET ${skip}
    `);

    const total = rows[0]?.total_count ?? 0;

    return SearchCategoriesResponseSchema.parse({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          emoji: row.emoji,
          colors: row.colors,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          // score: row.score,
        })),
        total,
        page,
        limit,
        hasMore: skip + rows.length < total,
      },
    });
  }
}
