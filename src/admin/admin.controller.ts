import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBody, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  type AdminReviewArticleListQuery,
  AdminReviewArticleListQuerySchema,
  type AdminModerateArticleResponse,
  type AdminReviewArticleListResponse,
  type AdminUserArticleListQuery,
  type AdminUserArticleListResponse,
  type AdminUserListQuery,
  type AdminUserListResponse,
  AdminUserArticleListQuerySchema,
  AdminUserListQuerySchema,
  ReviewRemarkUpsertSchema,
  type ReviewRemarkListResponse,
  type ReviewRemarkResponse,
  type ReviewRemarkUpsert,
} from "@smth/shared";
import type { RequestWithUserId } from "../common/types/request.types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { AdminModerateUserResponse } from "./admin.types";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@Controller("admin")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles("admin", "moderator")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("articles/review")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "authorId", required: false, type: String })
  @ApiOkResponse({ description: "AdminReviewArticleListResponse from @smth/shared" })
  listReviewArticles(
    @Query(new ZodValidationPipe(AdminReviewArticleListQuerySchema)) query: AdminReviewArticleListQuery,
  ): Promise<AdminReviewArticleListResponse> {
    return this.adminService.listReviewArticles(query);
  }

  @Post("articles/:id/approve")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "AdminModerateArticleResponse from @smth/shared" })
  approveArticle(
    @Param("id") id: string,
    @Request() req: RequestWithUserId,
  ): Promise<AdminModerateArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.adminService.approveArticle(id, userId);
  }

  @Post("articles/:id/reject")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "AdminModerateArticleResponse from @smth/shared" })
  rejectArticle(
    @Param("id") id: string,
    @Request() req: RequestWithUserId,
  ): Promise<AdminModerateArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.adminService.rejectArticle(id, userId);
  }

  @Post("articles/:id/archive")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "AdminModerateArticleResponse from @smth/shared" })
  archiveArticle(
    @Param("id") id: string,
    @Request() req: RequestWithUserId,
  ): Promise<AdminModerateArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.adminService.archiveArticle(id, userId);
  }

  @Post("articles/:id/publish")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "AdminModerateArticleResponse from @smth/shared" })
  publishArchivedArticle(
    @Param("id") id: string,
    @Request() req: RequestWithUserId,
  ): Promise<AdminModerateArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.adminService.publishArchivedArticle(id, userId);
  }

  @Get("users")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiOkResponse({ description: "AdminUserListResponse from @smth/shared" })
  listUsers(
    @Query(new ZodValidationPipe(AdminUserListQuerySchema)) query: AdminUserListQuery,
  ): Promise<AdminUserListResponse> {
    return this.adminService.listUsers(query);
  }

  @Post("users/:id/ban")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "AdminModerateUserResponse from @smth/shared" })
  banUser(
    @Param("id") id: string,
    @Request() req: RequestWithUserId,
  ): Promise<AdminModerateUserResponse> {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new UnauthorizedException("Unauthorized");
    return this.adminService.banUser(id, actorUserId);
  }

  @Post("users/:id/unban")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "AdminModerateUserResponse from @smth/shared" })
  unbanUser(
    @Param("id") id: string,
    @Request() req: RequestWithUserId,
  ): Promise<AdminModerateUserResponse> {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new UnauthorizedException("Unauthorized");
    return this.adminService.unbanUser(id, actorUserId);
  }

  @Get("users/:id/articles")
  @ApiParam({ name: "id", type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, enum: ["published", "draft", "archived", "review"] })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiOkResponse({ description: "AdminUserArticleListResponse from @smth/shared" })
  listUserArticles(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(AdminUserArticleListQuerySchema)) query: AdminUserArticleListQuery,
  ): Promise<AdminUserArticleListResponse> {
    return this.adminService.listUserArticles(id, query);
  }

  @Get("articles/:id/remarks")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "ReviewRemarkListResponse from @smth/shared" })
  listArticleRemarks(@Param("id") id: string): Promise<ReviewRemarkListResponse> {
    return this.adminService.listArticleRemarks(id);
  }

  @Put("articles/:id/remarks/:blockId")
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "blockId", type: String })
  @ApiBody({ description: "ReviewRemarkUpsertSchema from @smth/shared" })
  @ApiOkResponse({ description: "ReviewRemarkResponse from @smth/shared" })
  upsertArticleRemark(
    @Param("id") id: string,
    @Param("blockId") blockId: string,
    @Body(new ZodValidationPipe(ReviewRemarkUpsertSchema)) dto: ReviewRemarkUpsert,
    @Request() req: RequestWithUserId,
  ): Promise<ReviewRemarkResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.adminService.upsertArticleRemark(id, blockId, userId, dto as ReviewRemarkUpsert);
  }

  @Delete("articles/:id/remarks/:blockId")
  @ApiParam({ name: "id", type: String })
  @ApiParam({ name: "blockId", type: String })
  @ApiOkResponse({ description: "ReviewRemarkResponse from @smth/shared" })
  deleteArticleRemark(
    @Param("id") id: string,
    @Param("blockId") blockId: string,
  ): Promise<ReviewRemarkResponse> {
    return this.adminService.deleteArticleRemark(id, blockId);
  }
}



