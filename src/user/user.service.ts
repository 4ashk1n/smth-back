import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ArticleMetaSchema } from "@smth/shared";
import type { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateUserSchema, UserDtoSchema, type UserDto } from "./user.schemas";

type UpdateDto = z.infer<typeof UpdateUserSchema>;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.user.findMany({
      select: { id: true, username: true, firstname: true, lastname: true, avatar: true, email: true, provider: true },
      orderBy: { createdAt: "desc" },
    });

    const items: UserDto[] = rows.map((row) => ({
      id: row.id,
      username: row.username,
      firstname: row.firstname,
      lastname: row.lastname,
      avatar: row.avatar,
      email: row.email,
      provider: row.provider,
    }));

    return { success: true, data: UserDtoSchema.array().parse(items) };
  }

  async getById(id: string) {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, firstname: true, lastname: true, avatar: true, email: true, provider: true },
    });
    if (!row) throw new NotFoundException("User not found");

    const dto: UserDto = {
      id: row.id,
      username: row.username,
      firstname: row.firstname,
      lastname: row.lastname,
      avatar: row.avatar,
      email: row.email,
      provider: row.provider,
    };

    return { success: true, data: UserDtoSchema.parse(dto) };
  }

  async update(id: string, dto: UpdateDto) {
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
      select: { id: true, username: true, firstname: true, lastname: true, avatar: true, email: true, provider: true },
    });

    const result: UserDto = {
      id: updated.id,
      username: updated.username,
      firstname: updated.firstname,
      lastname: updated.lastname,
      avatar: updated.avatar,
      email: updated.email,
      provider: updated.provider,
    };

    return { success: true, data: UserDtoSchema.parse(result) };
  }

  async subscribe(currentUserId: string, targetUserId: string) {
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

    return { success: true, data: row };
  }

  async unsubscribe(currentUserId: string, targetUserId: string) {
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

    return { success: true, data: existing };
  }

  async getPublishedArticles(userId: string) {
    return this.getArticleMetaList({
      authorId: userId,
      status: "published",
    });
  }

  async getOtherArticles(currentUserId: string, userId: string) {
    this.ensureSelf(currentUserId, userId);
    return this.getArticleMetaList({
      authorId: userId,
      status: { in: ["draft", "archived", "review"] },
    });
  }

  async getLikedArticles(currentUserId: string, userId: string) {
    this.ensureSelf(currentUserId, userId);
    return this.getMetricArticles(userId, { liked: true });
  }

  async getSavedArticles(currentUserId: string, userId: string) {
    this.ensureSelf(currentUserId, userId);
    return this.getMetricArticles(userId, { saved: true });
  }

  async getRepostedArticles(userId: string) {
    return this.getMetricArticles(userId, { reposted: true }, true);
  }

  async getFollowing(userId: string) {
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

    return {
      success: true,
      data: rows.map((row) => ({
        user: row.following,
        subscribedAt: row.createdAt,
      })),
    };
  }

  async getFollowers(userId: string) {
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

    return {
      success: true,
      data: rows.map((row) => ({
        user: row.follower,
        subscribedAt: row.createdAt,
      })),
    };
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

    return { success: true, data: ArticleMetaSchema.array().parse(items) };
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

    return { success: true, data: ArticleMetaSchema.array().parse(items) };
  }

  private ensureSelf(currentUserId: string, targetUserId: string) {
    if (currentUserId !== targetUserId) {
      throw new ForbiddenException("Access denied");
    }
  }
}
