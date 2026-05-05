import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  MarkAllNotificationsReadResponseSchema,
  MarkNotificationReadResponseSchema,
  NotificationSettingsSchema,
  NotificationListQuerySchema,
  NotificationListResponseSchema,
  type NotificationListQuery,
  type NotificationListResponse,
  type NotificationSettings,
  type NotificationType,
  UnreadNotificationsCountResponseSchema,
  type MarkAllNotificationsReadResponse,
  type MarkNotificationReadResponse,
  type UnreadNotificationsCountResponse,
} from "@smth/shared";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  likes: true,
  comments: true,
  subscriptions: true,
  articleStatus: true,
};

type CreateNotificationInput = {
  type: NotificationType;
  recipientUserId: string;
  actorUserId?: string | null;
  payload: Record<string, unknown>;
};

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, query: NotificationListQuery): Promise<NotificationListResponse> {
    const { page, limit } = NotificationListQuerySchema.parse(query);
    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      this.prisma.notification.count({
        where: { recipientUserId: userId },
      }),
      this.prisma.notification.findMany({
        where: { recipientUserId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          recipientUserId: true,
          actorUserId: true,
          payload: true,
          createdAt: true,
          readAt: true,
          actor: {
            select: {
              id: true,
              username: true,
              firstname: true,
              lastname: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    return NotificationListResponseSchema.parse({
      success: true,
      data: {
        items: rows.map((row) => ({
          ...row,
          payload: (row.payload ?? {}) as Record<string, unknown>,
        })),
        total,
        page,
        limit,
        hasMore: skip + rows.length < total,
      },
    });
  }

  async unreadCountForUser(userId: string): Promise<UnreadNotificationsCountResponse> {
    const count = await this.prisma.notification.count({
      where: {
        recipientUserId: userId,
        readAt: null,
      },
    });

    return UnreadNotificationsCountResponseSchema.parse({
      success: true,
      data: { count },
    });
  }

  async markRead(userId: string, notificationId: string): Promise<MarkNotificationReadResponse> {
    const row = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, recipientUserId: true },
    });

    if (!row || row.recipientUserId !== userId) {
      throw new NotFoundException("Notification not found");
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
      select: {
        id: true,
        readAt: true,
      },
    });

    return MarkNotificationReadResponseSchema.parse({
      success: true,
      data: {
        id: updated.id,
        readAt: updated.readAt,
      },
    });
  }

  async markAllRead(userId: string): Promise<MarkAllNotificationsReadResponse> {
    const updated = await this.prisma.notification.updateMany({
      where: {
        recipientUserId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return MarkAllNotificationsReadResponseSchema.parse({
      success: true,
      data: { count: updated.count },
    });
  }

  async createNotification(input: CreateNotificationInput): Promise<void> {
    const { type, recipientUserId, actorUserId, payload } = input;
    if (type !== "article_status" && actorUserId && actorUserId === recipientUserId) {
      return;
    }
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientUserId },
      select: {
        id: true,
        notificationSettings: true,
      },
    });
    if (!recipient) {
      return;
    }

    const settings = this.toNotificationSettings(recipient.notificationSettings);
    if (!this.isNotificationEnabled(type, settings)) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        type,
        recipientUserId,
        actorUserId: actorUserId ?? null,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private toNotificationSettings(value: unknown): NotificationSettings {
    const parsed = NotificationSettingsSchema.safeParse(value);
    if (parsed.success) return parsed.data;
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  private isNotificationEnabled(type: NotificationType, settings: NotificationSettings): boolean {
    switch (type) {
      case "like":
        return settings.likes;
      case "comment":
        return settings.comments;
      case "subscribe":
        return settings.subscriptions;
      case "article_status":
        return settings.articleStatus;
      default:
        return true;
    }
  }
}
