import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiBody,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  IsSubscribedResponse,
  type SubscribeUserResponse,
  type UnsubscribeUserResponse,
  UpdateUserSchema,
  type UserLikedArticlesResponse,
  type UserMeta,
  UserMetricsResponse,
  type UserOtherArticlesResponse,
  type UserPublishedArticlesResponse,
  type UserRepostedArticlesResponse,
  type UserSavedArticlesResponse
} from "@smth/shared";
import type { Request as ExpressRequest } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { UserService } from "./user.service";

type UpdateDto = z.infer<typeof UpdateUserSchema>;
type UserMetaResponse = { success: true; data: UserMeta };
type UserMetaListResponse = { success: true; data: UserMeta[] };
type RequestWithUser = ExpressRequest & {
  user?: {
    id: string;
  };
};

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

@Controller("users")
@ApiTags("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOkResponse({ description: "User list response from shared contract" })
  list(): Promise<UserMetaListResponse> {
    return this.userService.list();
  }

  @Get(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "User response from shared contract" })
  getById(@Param("id") id: string): Promise<UserMetaResponse> {
    return this.userService.getById(id);
  }

  @Patch(":id")
  @ApiParam({ name: "id", type: String })
  @ApiBody({ description: "UpdateUserSchema from @smth/shared" })
  @ApiOkResponse({ description: "UpdateUserResponse from @smth/shared" })
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(asZodType(UpdateUserSchema))) dto: UpdateDto,
  ): Promise<UserMetaResponse> {
    return this.userService.update(id, dto);
  }

  @Post(":id/subscribe")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "SubscribeUserResponse from @smth/shared" })
  subscribe(@Param("id") id: string, @Request() req: RequestWithUser): Promise<SubscribeUserResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.subscribe(currentUserId, id);
  }

  @Delete(":id/subscribe")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UnsubscribeUserResponse from @smth/shared" })
  unsubscribe(@Param("id") id: string, @Request() req: RequestWithUser): Promise<UnsubscribeUserResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.unsubscribe(currentUserId, id);
  }

  @Get(":id/articles/published")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UserPublishedArticlesResponse from @smth/shared" })
  getPublishedArticles(@Param("id") id: string): Promise<UserPublishedArticlesResponse> {
    return this.userService.getPublishedArticles(id);
  }

  @Get(":id/articles/other")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UserOtherArticlesResponse from @smth/shared" })
  getOtherArticles(@Param("id") id: string, @Request() req: RequestWithUser): Promise<UserOtherArticlesResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.getOtherArticles(currentUserId, id);
  }

  @Get(":id/articles/liked")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UserLikedArticlesResponse from @smth/shared" })
  getLikedArticles(@Param("id") id: string, @Request() req: RequestWithUser): Promise<UserLikedArticlesResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.getLikedArticles(currentUserId, id);
  }

  @Get(":id/articles/saved")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UserSavedArticlesResponse from @smth/shared" })
  getSavedArticles(@Param("id") id: string, @Request() req: RequestWithUser): Promise<UserSavedArticlesResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.getSavedArticles(currentUserId, id);
  }

  @Get(":id/articles/reposted")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UserRepostedArticlesResponse from @smth/shared" })
  getRepostedArticles(@Param("id") id: string): Promise<UserRepostedArticlesResponse> {
    return this.userService.getRepostedArticles(id);
  }

  // @Get(":id/following")
  // @ApiParam({ name: "id", type: String })
  // @ApiOkResponse({ description: "UserFollowingResponse from @smth/shared" })
  // getFollowing(@Param("id") id: string): Promise<UserFollowingResponse> {
  //   return this.userService.getFollowing(id);
  // }

  // @Get(":id/followers")
  // @ApiParam({ name: "id", type: String })
  // @ApiOkResponse({ description: "UserFollowersResponse from @smth/shared" })
  // getFollowers(@Param("id") id: string): Promise<UserFollowersResponse> {
  //   return this.userService.getFollowers(id);
  // }

  @Get(":id/metrics")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UserMetricsResponse from @smth/shared" })
  getMetrics(@Param("id") id: string): Promise<UserMetricsResponse> {
    return this.userService.getMetrics(id);
  }

  @Get(":id/subscribed")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "IsSubscribedResponse from @smth/shared" })
  isSubscribed(@Param("id") id: string, @Request() req: RequestWithUser): Promise<IsSubscribedResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.isSubscribed(currentUserId, id);
  }
}
