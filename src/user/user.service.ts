import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ArticleMetaSchema,
  SubscribeUserResponseSchema,
  UnsubscribeUserResponseSchema,
  UpdateUserResponseSchema,
  UserFollowersResponseSchema,
  UserFollowingResponseSchema,
  UserLikedArticlesResponseSchema,
  UserListResponseSchema,
  UserOtherArticlesResponseSchema,
  UserPublishedArticlesResponseSchema,
  UserRepostedArticlesResponseSchema,
  UserResponseSchema,
  UserSavedArticlesResponseSchema,
  type SubscribeUserResponse,
  type UnsubscribeUserResponse,
  type UpdateUserResponse,
  type UserFollowersResponse,
  type UserFollowingResponse,
  type UserLikedArticlesResponse,
  type UserListResponse,
  type UserOtherArticlesResponse,
  type UserPublishedArticlesResponse,
  type UserRepostedArticlesResponse,
  type UserResponse,
  type UserSavedArticlesResponse,
  UpdateUserSchema,
} from "@smth/shared";
import type { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

type UpdateDto = z.infer<typeof UpdateUserSchema>;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<UserListResponse> {
    const rows = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstname: true,
        lastname: true,
        avatar: true,
        role: true,
        email: true,
        googleId: true,
        refreshTokenHash: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return UserListResponseSchema.parse({ success: true, data: rows });
  }

  async getById(id: string): Promise<UserResponse> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        firstname: true,
        lastname: true,
        avatar: true,
        role: true,
        email: true,
        googleId: true,
        refreshTokenHash: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) throw new NotFoundException("User not found");

    return UserResponseSchema.parse({ success: true, data: row });
  }

  async update(id: string, dto: UpdateDto): Promise<UpdateUserResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("User not found");

    const data: Partial<UpdateDto> = {};
    if (dto.firstname !== undefined) data.firstname = dto.firstname;
    if (dto.lastname !== undefined) data.lastname = dto.lastname;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        firstname: true,
        lastname: true,
        avatar: true,
        role: true,
        email: true,
        googleId: true,
        refreshTokenHash: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return UpdateUserResponseSchema.parse({ success: true, data: updated });
  }

  async subscribe(currentUserId: string, targetUserId: string): Promise<SubscribeUserResponse> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException("You cannot subscribe to yourself");
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException("User not found");

    const existing = await this.prisma.userSubscription.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
      select: { followerId: true },
    });
    if (existing) {
      throw new BadRequestException("Already subscribed");
    }

    const row = await this.prisma.userSubscription.create({
      data: {
        followerId: currentUserId,
        followingId: targetUserId,
      },
      select: {
        followerId: true,
        followingId: true,
        createdAt: true,
      },
    });

    return SubscribeUserResponseSchema.parse({ success: true, data: row });
  }

  async unsubscribe(currentUserId: string, targetUserId: string): Promise<UnsubscribeUserResponse> {
    const existing = await this.prisma.userSubscription.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
      select: {
        followerId: true,
        followingId: true,
      },
    });
    if (!existing) {
      throw new BadRequestException("Subscription not found");
    }

    await this.prisma.userSubscription.delete({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    });

    return UnsubscribeUserResponseSchema.parse({ success: true, data: existing });
  }

  async getPublishedArticles(userId: string): Promise<UserPublishedArticlesResponse> {
    return this.getArticleMetaList({
      authorId: userId,
      status: "published",
    });
  }

  async getOtherArticles(currentUserId: string, userId: string): Promise<UserOtherArticlesResponse> {
    this.ensureSelf(currentUserId, userId);
    return this.getArticleMetaList({
      authorId: userId,
      status: { in: ["draft", "archived", "review"] },
    });
  }

  async getLikedArticles(currentUserId: string, userId: string): Promise<UserLikedArticlesResponse> {
    this.ensureSelf(currentUserId, userId);
    return this.getMetricArticles(userId, { liked: true });
  }

  async getSavedArticles(currentUserId: string, userId: string): Promise<UserSavedArticlesResponse> {
    this.ensureSelf(currentUserId, userId);
    return this.getMetricArticles(userId, { saved: true });
  }

  async getRepostedArticles(userId: string): Promise<UserRepostedArticlesResponse> {
    return this.getMetricArticles(userId, { reposted: true }, true);
  }

  async getFollowing(userId: string): Promise<UserFollowingResponse> {
    const rows = await this.prisma.userSubscription.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        following: {
          select: {
            id: true,
            username: true,
            firstname: true,
            lastname: true,
            avatar: true,
          },
        },
      },
    });

    return UserFollowingResponseSchema.parse({
      success: true,
      data: rows.map((row) => ({
        user: row.following,
        subscribedAt: row.createdAt,
      })),
    });
  }

  async getFollowers(userId: string): Promise<UserFollowersResponse> {
    const rows = await this.prisma.userSubscription.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        follower: {
          select: {
            id: true,
            username: true,
            firstname: true,
            lastname: true,
            avatar: true,
          },
        },
      },
    });

    return UserFollowersResponseSchema.parse({
      success: true,
      data: rows.map((row) => ({
        user: row.follower,
        subscribedAt: row.createdAt,
      })),
    });
  }

  private async getMetricArticles(
    userId: string,
    filter: { liked?: boolean; saved?: boolean; reposted?: boolean },
    onlyPublished = false,
  ) {
    const rows = await this.prisma.userArticleMetric.findMany({
      where: {
        userId,
        ...filter,
        ...(onlyPublished ? { article: { status: "published" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        article: {
          select: {
            id: true,
            title: true,
            description: true,
            authorId: true,
            status: true,
            mainCategoryId: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            categories: { select: { id: true } },
          },
        },
      },
    });

    const items = rows.map((row) => ({
      id: row.article.id,
      title: row.article.title,
      description: row.article.description,
      authorId: row.article.authorId,
      mainCategoryId: row.article.mainCategoryId,
      categories: row.article.categories.map((c) => c.id),
      status: row.article.status,
      publishedAt: row.article.publishedAt,
      createdAt: row.article.createdAt,
      updatedAt: row.article.updatedAt,
    }));

    return onlyPublished
      ? UserRepostedArticlesResponseSchema.parse({ success: true, data: ArticleMetaSchema.array().parse(items) })
      : filter.liked
        ? UserLikedArticlesResponseSchema.parse({ success: true, data: ArticleMetaSchema.array().parse(items) })
        : UserSavedArticlesResponseSchema.parse({ success: true, data: ArticleMetaSchema.array().parse(items) });
  }

  private async getArticleMetaList(where: any) {
    const rows = await this.prisma.article.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        authorId: true,
        status: true,
        mainCategoryId: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        categories: { select: { id: true } },
      },
    });

    const items = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      authorId: row.authorId,
      mainCategoryId: row.mainCategoryId,
      categories: row.categories.map((c) => c.id),
      status: row.status,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    const parsed = ArticleMetaSchema.array().parse(items);
    if (where?.status === "published") {
      return UserPublishedArticlesResponseSchema.parse({ success: true, data: parsed });
    }
    return UserOtherArticlesResponseSchema.parse({ success: true, data: parsed });
  }

  private ensureSelf(currentUserId: string, targetUserId: string) {
    if (currentUserId !== targetUserId) {
      throw new ForbiddenException("Access denied");
    }
  }
}
