import { Controller, Get, Param, Post, Query, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiOkResponse, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  type NotificationListQuery,
  NotificationListQuerySchema,
  type MarkAllNotificationsReadResponse,
  type MarkNotificationReadResponse,
  type NotificationListResponse,
  type UnreadNotificationsCountResponse,
} from "@smth/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { RequestWithUserId } from "../common/types/request.types";
import { NotificationService } from "./notification.service";

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
    @Request() req: RequestWithUserId,
    @Query(new ZodValidationPipe(NotificationListQuerySchema)) query: NotificationListQuery,
  ): Promise<NotificationListResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.notificationService.listForUser(userId, query);
  }

  @Get("unread-count")
  @ApiOkResponse({ description: "UnreadNotificationsCountResponse from @smth/shared" })
  unreadCount(@Request() req: RequestWithUserId): Promise<UnreadNotificationsCountResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.notificationService.unreadCountForUser(userId);
  }

  @Post("read-all")
  @ApiOkResponse({ description: "MarkAllNotificationsReadResponse from @smth/shared" })
  markAllRead(@Request() req: RequestWithUserId): Promise<MarkAllNotificationsReadResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.notificationService.markAllRead(userId);
  }

  @Post(":id/read")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "MarkNotificationReadResponse from @smth/shared" })
  markRead(@Request() req: RequestWithUserId, @Param("id") id: string): Promise<MarkNotificationReadResponse> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return this.notificationService.markRead(userId, id);
  }
}




