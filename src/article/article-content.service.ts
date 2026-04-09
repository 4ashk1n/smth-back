import { Injectable } from "@nestjs/common";
import { Content } from "@smth/shared";
import { PrismaService } from "../prisma/prisma.service";

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

@Injectable()
export class ArticleContentService {
  constructor(private readonly prisma: PrismaService) {}

  async buildContentByArticleId(articleId: string): Promise<Content> {
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
      WHERE t."articleId" = ${articleId}
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
          articleId,
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

    return {
      articleId,
      topics: Array.from(topicsMap.values()).sort((a, b) => a.order - b.order),
      pages: Array.from(pagesMap.values()).sort((a, b) => a.order - b.order),
      blocks: Array.from(blocksMap.values()),
    };
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
