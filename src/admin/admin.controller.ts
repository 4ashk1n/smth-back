import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBody, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  AdminReviewArticleListQuerySchema,
  type AdminModerateArticleResponse,
  type AdminReviewArticleListResponse,
  type AdminUserArticleListResponse,
  type AdminUserListResponse,
  AdminUserArticleListQuerySchema,
  AdminUserListQuerySchema,
  ReviewRemarkUpsertSchema,
  type ReviewRemarkListResponse,
  type ReviewRemarkResponse,
  type ReviewRemarkUpsert,
} from "@smth/shared";
import type { Request as ExpressRequest } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminService } from "./admin.service";

type ReviewListQuery = z.infer<typeof AdminReviewArticleListQuerySchema>;
type UserListQuery = z.infer<typeof AdminUserListQuerySchema>;
type UserArticleListQuery = z.infer<typeof AdminUserArticleListQuerySchema>;
type UpsertRemarkDto = z.infer<typeof ReviewRemarkUpsertSchema>;
type RequestWithUser = ExpressRequest & {
  user?: {
    id: string;
  };
};
type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

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
    @Query(new ZodValidationPipe(asZodType(AdminReviewArticleListQuerySchema))) query: ReviewListQuery,
  ): Promise<AdminReviewArticleListResponse> {
    return this.adminService.listReviewArticles(query);
  }

  @Post("articles/:id/approve")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "AdminModerateArticleResponse from @smth/shared" })
  approveArticle(
    @Param("id") id: string,
    @Request() req: RequestWithUser,
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
    @Request() req: RequestWithUser,
  ): Promise<AdminModerateArticleResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.adminService.rejectArticle(id, userId);
  }

  @Get("users")
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiOkResponse({ description: "AdminUserListResponse from @smth/shared" })
  listUsers(
    @Query(new ZodValidationPipe(asZodType(AdminUserListQuerySchema))) query: UserListQuery,
  ): Promise<AdminUserListResponse> {
    return this.adminService.listUsers(query);
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
    @Query(new ZodValidationPipe(asZodType(AdminUserArticleListQuerySchema))) query: UserArticleListQuery,
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
    @Body(new ZodValidationPipe(asZodType(ReviewRemarkUpsertSchema))) dto: UpsertRemarkDto,
    @Request() req: RequestWithUser,
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
