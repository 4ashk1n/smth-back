import { Body, Controller, Get, Param, Patch, Post, Query, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ArticleListQuerySchema, CreateArticleSchema, UpdateArticleSchema } from "@smth/shared";
import type { Request as ExpressRequest } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ArticleService } from "./article.service";
import { ArticleListResponse, ArticleResponse, CreateArticleDto, UpdateArticleDto } from "./article.swagger";

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
  @ApiOkResponse({ type: ArticleListResponse })
  list(@Query(new ZodValidationPipe(asZodType(ArticleListQuerySchema))) query: ListQuery) {
    return this.articleService.list(query);
  }

  @Get(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ type: ArticleResponse })
  getById(@Param("id") id: string) {
    return this.articleService.getById(id);
  }

  @Post()
  @ApiBody({ type: CreateArticleDto })
  @ApiCreatedResponse({ type: ArticleResponse })
  create(@Body(new ZodValidationPipe(asZodType(CreateArticleSchema))) dto: CreateDto) {
    return this.articleService.create(dto);
  }

  @Patch(":id")
  @ApiParam({ name: "id", type: String })
  @ApiBody({ type: UpdateArticleDto })
  @ApiOkResponse({ type: ArticleResponse })
  update(@Param("id") id: string, @Body(new ZodValidationPipe(asZodType(UpdateArticleSchema))) dto: UpdateDto) {
    return this.articleService.update(id, dto);
  }

  @Post(":id/like")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Article liked" })
  like(@Param("id") id: string, @Request() req: RequestWithUser) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.likeArticle(id, userId);
  }

  @Post(":id/dislike")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Article disliked" })
  dislike(@Param("id") id: string, @Request() req: RequestWithUser) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.dislikeArticle(id, userId);
  }
}
