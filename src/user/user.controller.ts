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
  type UserProfileUpdate,
  UpdateUserProfileSchema,
  type UserLikedArticlesResponse,
  UserMetricsResponse,
  type UserOtherArticlesResponse,
  type UserPublishedArticlesResponse,
  type UserRepostedArticlesResponse,
  type UserSavedArticlesResponse,
} from "@smth/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { RequestWithUserId } from "../common/types/request.types";
import type { UserMetaListResponse, UserMetaResponse } from "./user.types";
import { UserService } from "./user.service";

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
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiBody({ description: "UpdateUserProfileSchema from @smth/shared" })
  @ApiOkResponse({ description: "UpdateUserProfileResponse from @smth/shared" })
  update(
    @Param("id") id: string,
    @Request() req: RequestWithUserId,
    @Body(new ZodValidationPipe(UpdateUserProfileSchema)) dto: UserProfileUpdate,
  ): Promise<UserMetaResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.update(currentUserId, id, dto);
  }

  @Post(":id/subscribe")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "SubscribeUserResponse from @smth/shared" })
  subscribe(@Param("id") id: string, @Request() req: RequestWithUserId): Promise<SubscribeUserResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.subscribe(currentUserId, id);
  }

  @Delete(":id/subscribe")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UnsubscribeUserResponse from @smth/shared" })
  unsubscribe(@Param("id") id: string, @Request() req: RequestWithUserId): Promise<UnsubscribeUserResponse> {
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
  getOtherArticles(@Param("id") id: string, @Request() req: RequestWithUserId): Promise<UserOtherArticlesResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.getOtherArticles(currentUserId, id);
  }

  @Get(":id/articles/liked")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UserLikedArticlesResponse from @smth/shared" })
  getLikedArticles(@Param("id") id: string, @Request() req: RequestWithUserId): Promise<UserLikedArticlesResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.getLikedArticles(currentUserId, id);
  }

  @Get(":id/articles/saved")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "UserSavedArticlesResponse from @smth/shared" })
  getSavedArticles(@Param("id") id: string, @Request() req: RequestWithUserId): Promise<UserSavedArticlesResponse> {
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
  isSubscribed(@Param("id") id: string, @Request() req: RequestWithUserId): Promise<IsSubscribedResponse> {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.isSubscribed(currentUserId, id);
  }
}




