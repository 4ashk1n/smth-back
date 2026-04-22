import { Controller, Get, Param, Post, Query, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  NotificationListQuerySchema,
  type MarkAllNotificationsReadResponse,
  type MarkNotificationReadResponse,
  type NotificationListResponse,
  type UnreadNotificationsCountResponse,
} from "@smth/shared";
import type { Request as ExpressRequest } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { NotificationService } from "./notification.service";

type RequestWithUser = ExpressRequest & {
  user?: {
    id: string;
  };
};
type ListQuery = z.infer<typeof NotificationListQuerySchema>;
type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(AuthGuard("jwt"))
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ description: "NotificationListResponse from @smth/shared" })
  list(
    @Request() req: RequestWithUser,
    @Query(new ZodValidationPipe(asZodType(NotificationListQuerySchema))) query: ListQuery,
  ): Promise<NotificationListResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.notificationService.listForUser(userId, query);
  }

  @Get("unread-count")
  @ApiOkResponse({ description: "UnreadNotificationsCountResponse from @smth/shared" })
  unreadCount(@Request() req: RequestWithUser): Promise<UnreadNotificationsCountResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.notificationService.unreadCountForUser(userId);
  }

  @Post("read-all")
  @ApiOkResponse({ description: "MarkAllNotificationsReadResponse from @smth/shared" })
  markAllRead(@Request() req: RequestWithUser): Promise<MarkAllNotificationsReadResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.notificationService.markAllRead(userId);
  }

  @Post(":id/read")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "MarkNotificationReadResponse from @smth/shared" })
  markRead(@Request() req: RequestWithUser, @Param("id") id: string): Promise<MarkNotificationReadResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.notificationService.markRead(userId, id);
  }
}
