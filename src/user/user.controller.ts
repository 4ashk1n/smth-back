import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBody, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request as ExpressRequest } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { UpdateUserSchema } from "./user.schemas";
import { UserService } from "./user.service";
import { UpdateUserDto, UserListResponse, UserResponse } from "./user.swagger";

type UpdateDto = z.infer<typeof UpdateUserSchema>;
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
  @ApiOkResponse({ type: UserListResponse })
  list() {
    return this.userService.list();
  }

  @Get(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ type: UserResponse })
  getById(@Param("id") id: string) {
    return this.userService.getById(id);
  }

  @Patch(":id")
  @ApiParam({ name: "id", type: String })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ type: UserResponse })
  update(@Param("id") id: string, @Body(new ZodValidationPipe(asZodType(UpdateUserSchema))) dto: UpdateDto) {
    return this.userService.update(id, dto);
  }

  @Post(":id/subscribe")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Subscribed to user" })
  subscribe(@Param("id") id: string, @Request() req: RequestWithUser) {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.subscribe(currentUserId, id);
  }

  @Delete(":id/subscribe")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Unsubscribed from user" })
  unsubscribe(@Param("id") id: string, @Request() req: RequestWithUser) {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.unsubscribe(currentUserId, id);
  }

  @Get(":id/articles/published")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Published articles by user" })
  getPublishedArticles(@Param("id") id: string) {
    return this.userService.getPublishedArticles(id);
  }

  @Get(":id/articles/other")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Draft/archived/review articles by user (self only)" })
  getOtherArticles(@Param("id") id: string, @Request() req: RequestWithUser) {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.getOtherArticles(currentUserId, id);
  }

  @Get(":id/articles/liked")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Liked articles by user (self only)" })
  getLikedArticles(@Param("id") id: string, @Request() req: RequestWithUser) {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.getLikedArticles(currentUserId, id);
  }

  @Get(":id/articles/saved")
  @UseGuards(AuthGuard("jwt"))
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Saved articles by user (self only)" })
  getSavedArticles(@Param("id") id: string, @Request() req: RequestWithUser) {
    const currentUserId = req.user?.id;
    if (!currentUserId) throw new UnauthorizedException("Unauthorized");
    return this.userService.getSavedArticles(currentUserId, id);
  }

  @Get(":id/articles/reposted")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "Reposted articles by user" })
  getRepostedArticles(@Param("id") id: string) {
    return this.userService.getRepostedArticles(id);
  }

  @Get(":id/following")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "User following list" })
  getFollowing(@Param("id") id: string) {
    return this.userService.getFollowing(id);
  }

  @Get(":id/followers")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "User followers list" })
  getFollowers(@Param("id") id: string) {
    return this.userService.getFollowers(id);
  }
}
