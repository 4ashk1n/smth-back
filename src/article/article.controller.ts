import { Body, Controller, Delete, Get, Param, Post, Query, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  type AiSuggestionsResponse,
  type ArticleCommentListQuery,
  ArticleCommentListQuerySchema,
  type ArticleCommentListResponse,
  type ArticleCommentResponse,
  ArticleContentResponse,
  type ArticleListQuery,
  ArticleListQuerySchema,
  type ArticleListResponse,
  ArticleMetricsResponse,
  type ArticleResponse,
  type CreateArticleComment,
  CreateArticleCommentSchema,
  type CreateEmptyDraft,
  type CreateEmptyDraftResponse,
  CreateEmptyDraftSchema,
  type DeleteArticleCommentResponse,
  type DislikeArticleResponse,
  type LikeArticleResponse,
  type UpdateArticleReadMetrics,
  type UpdateArticleReadMetricsResponse,
  UpdateArticleReadMetricsSchema,
  type ArticleUpdate,
  type UpdateArticleResponse,
  UpdateArticleSchema,
} from "@smth/shared";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { RequestWithUserRole } from "../common/types/request.types";
import { ArticleService } from "./article.service";

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
  list(@Query(new ZodValidationPipe(ArticleListQuerySchema)) query: ArticleListQuery): Promise<ArticleListResponse> {
    return this.articleService.list(query);
  }

  @Get("feed")
  @UseGuards(AuthGuard("jwt"))
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, enum: ["published", "draft", "archived", "review"] })
  @ApiQuery({ name: "mainCategoryId", required: false, type: String })
  @ApiQuery({ name: "authorId", required: false, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiOkResponse({ description: "ArticleListResponse from @smth/shared" })
  feed(
    @Query(new ZodValidationPipe(ArticleListQuerySchema)) query: ArticleListQuery,
    @Request() req: RequestWithUserRole,
  ): Promise<ArticleListResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.getFeed(query, userId);
  }

  @Post("empty-draft")
  @UseGuards(AuthGuard("jwt"))
  @ApiBody({ description: "CreateEmptyDraftSchema from @smth/shared" })
  @ApiCreatedResponse({ description: "CreateEmptyDraftResponse from @smth/shared" })
  createEmptyDraft(
    @Body(new ZodValidationPipe(CreateEmptyDraftSchema)) dto: CreateEmptyDraft,
    @Request() req: RequestWithUserRole,
  ): Promise<CreateEmptyDraftResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    const payload = dto as CreateEmptyDraft;
    if (payload.authorId !== userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.createEmptyDraft(userId);
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleResponse from @smth/shared" })
  getById(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<ArticleResponse> {
    return this.articleService.getById(id, req.user?.id, req.user?.role);
  }

  @Get(':id/content')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: "ArticleContentResponse from @smth/shared" })
  getContentById(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<ArticleContentResponse> {
    return this.articleService.getContentById(id, req.user?.id, req.user?.role);
  }

  @Get(':id/metrics')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  getMetricsById(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<ArticleMetricsResponse> {
    return this.articleService.getMetricsById(id, req.user?.id);
  }

  @Post(":id/metrics/read")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiBody({ description: "UpdateArticleReadMetricsSchema from @smth/shared" })
  @ApiOkResponse({ description: "UpdateArticleReadMetricsResponse from @smth/shared" })
  reportReadMetrics(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateArticleReadMetricsSchema)) dto: UpdateArticleReadMetrics,
    @Request() req: RequestWithUserRole,
  ): Promise<UpdateArticleReadMetricsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.reportReadMetrics(id, userId, dto as UpdateArticleReadMetrics);
  }

  @Get(":id/review-remarks")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "AiSuggestionsResponse from @smth/shared" })
  getReviewRemarks(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<AiSuggestionsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.getReviewRemarksAsSuggestions(id, userId, req.user?.role);
  }

  @Get(":id/comments")
  @ApiParam({ name: "id", type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ description: "ArticleCommentListResponse from @smth/shared" })
  listComments(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(ArticleCommentListQuerySchema)) query: ArticleCommentListQuery,
  ): Promise<ArticleCommentListResponse> {
    return this.articleService.listComments(id, query);
  }

  @Post(":id/comments")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiBody({ description: "CreateArticleCommentSchema from @smth/shared" })
  @ApiOkResponse({ description: "ArticleCommentResponse from @smth/shared" })
  createComment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateArticleCommentSchema)) dto: CreateArticleComment,
    @Request() req: RequestWithUserRole,
  ): Promise<ArticleCommentResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.createComment(id, userId, dto as CreateArticleComment);
  }

  @Delete(":id/comments/:commentId")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "commentId", type: String })
  @ApiOkResponse({ description: "DeleteArticleCommentResponse from @smth/shared" })
  deleteComment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @Request() req: RequestWithUserRole,
  ): Promise<DeleteArticleCommentResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.deleteComment(id, commentId, userId);
  }

  @Post(":id/draft")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiBody({ description: "UpdateArticleSchema from @smth/shared" })
  @ApiOkResponse({ description: "UpdateArticleResponse from @smth/shared" })
  saveDraft(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateArticleSchema)) dto: ArticleUpdate,
    @Request() req: RequestWithUserRole,
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
    @Body(new ZodValidationPipe(UpdateArticleSchema)) dto: ArticleUpdate,
    @Request() req: RequestWithUserRole,
  ): Promise<UpdateArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.submitForReviewById(id, userId, dto);
  }

  @Delete(":id/draft")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Delete draft response" })
  deleteById(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<{ success: true; data: { id: string } }> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.deleteByIdForAuthor(id, userId);
  }

  @Post(":id/like")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "LikeArticleResponse from @smth/shared" })
  like(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<LikeArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.likeArticle(id, userId);
  }

  @Delete(":id/like")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "LikeArticleResponse from @smth/shared" })
  unlike(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<LikeArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.unlikeArticle(id, userId);
  }

  @Post(":id/dislike")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "DislikeArticleResponse from @smth/shared" })
  dislike(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<DislikeArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.dislikeArticle(id, userId);
  }

  @Delete(":id/dislike")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "DislikeArticleResponse from @smth/shared" })
  undislike(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<DislikeArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.undislikeArticle(id, userId);
  }

  @Post(":id/save")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  save(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<ArticleMetricsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.saveArticle(id, userId);
  }

  @Delete(":id/save")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  unsave(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<ArticleMetricsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.unsaveArticle(id, userId);
  }

  @Post(":id/repost")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  repost(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<ArticleMetricsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.repostArticle(id, userId);
  }

  @Delete(":id/repost")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ArticleMetricsResponse from @smth/shared" })
  unrepost(@Param("id") id: string, @Request() req: RequestWithUserRole): Promise<ArticleMetricsResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.articleService.unrepostArticle(id, userId);
  }
}





