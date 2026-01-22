import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CategoryDto } from "../category/category.swagger";

export class ArticleMetaDto {
  @ApiProperty({ example: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" })
  id!: string;

  @ApiProperty({ example: "My first article" })
  title!: string;

  @ApiProperty({ example: "Short description" })
  description!: string;

  @ApiProperty({ example: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" })
  mainCategory!: string;

  @ApiProperty({ type: [String], example: ["9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11"] })
  categories!: string[];

  @ApiProperty({ enum: ["published", "draft", "archived", "review"] })
  status!: "published" | "draft" | "archived" | "review";
}

export class ArticleDto {
  @ApiProperty({ example: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" })
  id!: string;

  @ApiProperty({ example: "My first article" })
  title!: string;

  @ApiProperty({ example: "Short description" })
  description!: string;

  @ApiProperty({ example: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" })
  mainCategory!: string;

  @ApiProperty({ enum: ["published", "draft", "archived", "review"] })
  status!: "published" | "draft" | "archived" | "review";

  @ApiProperty({ type: Object })
  content!: Record<string, unknown>;

  @ApiProperty({ type: [CategoryDto] })
  categories!: CategoryDto[];
}

export class CreateArticleDto {
  @ApiProperty({ example: "My first article" })
  title!: string;

  @ApiProperty({ example: "Short description" })
  description!: string;

  @ApiProperty({ example: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" })
  mainCategory!: string;

  @ApiProperty({ type: [String], example: ["9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11"] })
  categoryIds!: string[];

  @ApiProperty({ type: Object })
  content!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ["published", "draft", "archived", "review"] })
  status?: "published" | "draft" | "archived" | "review";
}

export class UpdateArticleDto {
  @ApiPropertyOptional({ example: "My first article" })
  title?: string;

  @ApiPropertyOptional({ example: "Short description" })
  description?: string;

  @ApiPropertyOptional({ example: "9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11" })
  mainCategory?: string;

  @ApiPropertyOptional({ type: [String], example: ["9a7f3f0b-4b8f-4c8b-b0d2-9f2e2c1c5b11"] })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: Object })
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ["published", "draft", "archived", "review"] })
  status?: "published" | "draft" | "archived" | "review";
}

export class ArticleResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: ArticleDto })
  data!: ArticleDto;
}

export class ArticleMetaResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: ArticleMetaDto })
  data!: ArticleMetaDto;
}

export class ArticleListResponse {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    type: Object,
    example: {
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      hasMore: false,
    },
  })
  data!: {
    items: ArticleMetaDto[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
