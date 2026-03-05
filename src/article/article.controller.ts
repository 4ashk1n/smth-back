import { Body, Controller, Get, Param, Patch, Post, Query, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  ArticleContentResponse,
  ArticleListQuerySchema,
  type ArticleListResponse,
  type ArticleResponse,
  type CreateArticleResponse,
  CreateArticleSchema,
  type DislikeArticleResponse,
  type LikeArticleResponse,
  type UpdateArticleResponse,
  UpdateArticleSchema,
} from "@smth/shared";
import type { Request as ExpressRequest } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ArticleService } from "./article.service";

type ListQuery = z.infer<typeof ArticleListQuerySchema>;
type CreateDto = z.infer<typeof CreateArticleSchema>;
type UpdateDto = z.infer<typeof UpdateArticleSchema>;
type RequestWithUser = ExpressRequest & {
  user?: {
    id: string;
  };
};

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;
@ApiTags("articles")
@Controller("articles")
export class ArticleController {
  constructor(private readonly articleService: ArticleService) { }

  @Get()
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, enum: ["published", "draft", "archived", "review"] })
  @ApiQuery({ name: "mainCategoryId", required: false, type: String })
  @ApiQuery({ name: "authorId", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiOkResponse({ description: "ArticleListResponse from @smth/shared" })
  list(@Query(new ZodValidationPipe(asZodType(ArticleListQuerySchema))) query: ListQuery): Promise<ArticleListResponse> {
    return this.articleService.list(query);
  }

  @Get(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleResponse from @smth/shared" })
  getById(@Param("id") id: string): Promise<ArticleResponse> {
    return this.articleService.getById(id);
  }

  @Get(':id/content')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: "ArticleContentResponse from @smth/shared" })
  getContentById(@Param("id") id: string): Promise<ArticleContentResponse> {
    return this.articleService.getContentById(id);
  }

  @Post()
  @ApiBody({ description: "CreateArticleSchema from @smth/shared" })
  @ApiCreatedResponse({ description: "CreateArticleResponse from @smth/shared" })
  create(@Body(new ZodValidationPipe(asZodType(CreateArticleSchema))) dto: CreateDto): Promise<CreateArticleResponse> {
    return this.articleService.create(dto);
  }

  @Patch(":id")
  @ApiParam({ name: "id", type: String })
  @ApiBody({ description: "UpdateArticleSchema from @smth/shared" })
  @ApiOkResponse({ description: "UpdateArticleResponse from @smth/shared" })
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(asZodType(UpdateArticleSchema))) dto: UpdateDto,
  ): Promise<UpdateArticleResponse> {
    return this.articleService.update(id, dto);
  }

  @Post(":id/like")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "LikeArticleResponse from @smth/shared" })
  like(@Param("id") id: string, @Request() req: RequestWithUser): Promise<LikeArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.likeArticle(id, userId);
  }

  @Post(":id/dislike")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "DislikeArticleResponse from @smth/shared" })
  dislike(@Param("id") id: string, @Request() req: RequestWithUser): Promise<DislikeArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.dislikeArticle(id, userId);
  }
}
