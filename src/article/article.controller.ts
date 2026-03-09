import { Body, Controller, Delete, Get, Param, Post, Query, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  ArticleContentResponse,
  ArticleListQuerySchema,
  type ArticleListResponse,
  ArticleMetricsResponse,
  type ArticleResponse,
  type CreateEmptyDraft,
  type CreateEmptyDraftResponse,
  CreateEmptyDraftSchema,
  type DislikeArticleResponse,
  type LikeArticleResponse,
  type UpdateArticleResponse,
  UpdateArticleSchema,
} from "@smth/shared";
import type { Request as ExpressRequest } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import { ArticleService } from "./article.service";

type ListQuery = z.infer<typeof ArticleListQuerySchema>;
type CreateEmptyDraftDto = z.infer<typeof CreateEmptyDraftSchema>;
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

  @Post("empty-draft")
  @UseGuards(AuthGuard("jwt"))
  @ApiBody({ description: "CreateEmptyDraftSchema from @smth/shared" })
  @ApiCreatedResponse({ description: "CreateEmptyDraftResponse from @smth/shared" })
  createEmptyDraft(
    @Body(new ZodValidationPipe(asZodType(CreateEmptyDraftSchema))) dto: CreateEmptyDraftDto,
    @Request() req: RequestWithUser,
  ): Promise<CreateEmptyDraftResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    const payload = dto as CreateEmptyDraft;
    if (payload.authorId !== userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.createEmptyDraft(userId);
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

  @Get(':id/metrics')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  getMetricsById(@Param("id") id: string, @Request() req: RequestWithUser): Promise<ArticleMetricsResponse> {
    return this.articleService.getMetricsById(id, req.user?.id);
  }

  @Post(":id/draft")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiBody({ description: "UpdateArticleSchema from @smth/shared" })
  @ApiOkResponse({ description: "UpdateArticleResponse from @smth/shared" })
  saveDraft(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(asZodType(UpdateArticleSchema))) dto: UpdateDto,
    @Request() req: RequestWithUser,
  ): Promise<UpdateArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.saveDraftById(id, userId, dto);
  }

  @Post(":id/review")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiBody({ description: "UpdateArticleSchema from @smth/shared" })
  @ApiOkResponse({ description: "UpdateArticleResponse from @smth/shared" })
  submitForReview(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(asZodType(UpdateArticleSchema))) dto: UpdateDto,
    @Request() req: RequestWithUser,
  ): Promise<UpdateArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.submitForReviewById(id, userId, dto);
  }

  @Delete(":id/draft")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Delete draft response" })
  deleteById(@Param("id") id: string, @Request() req: RequestWithUser): Promise<{ success: true; data: { id: string } }> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.deleteByIdForAuthor(id, userId);
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

  @Delete(":id/like")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "LikeArticleResponse from @smth/shared" })
  unlike(@Param("id") id: string, @Request() req: RequestWithUser): Promise<LikeArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.unlikeArticle(id, userId);
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

  @Delete(":id/dislike")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "DislikeArticleResponse from @smth/shared" })
  undislike(@Param("id") id: string, @Request() req: RequestWithUser): Promise<DislikeArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.undislikeArticle(id, userId);
  }

  @Post(":id/save")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  save(@Param("id") id: string, @Request() req: RequestWithUser): Promise<ArticleMetricsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.saveArticle(id, userId);
  }

  @Delete(":id/save")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  unsave(@Param("id") id: string, @Request() req: RequestWithUser): Promise<ArticleMetricsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.unsaveArticle(id, userId);
  }

  @Post(":id/repost")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  repost(@Param("id") id: string, @Request() req: RequestWithUser): Promise<ArticleMetricsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.repostArticle(id, userId);
  }

  @Delete(":id/repost")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  unrepost(@Param("id") id: string, @Request() req: RequestWithUser): Promise<ArticleMetricsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.unrepostArticle(id, userId);
  }
}
