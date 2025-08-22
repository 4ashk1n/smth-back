// src/article/article.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetArticleCardDTO } from 'smth-shared'; // zod-схема
import type { z } from 'zod';

type ArticleCard = z.infer<typeof GetArticleCardDTO>;

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<ArticleCard[]> {
    const rows = await this.prisma.article.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        cover: true,
        status: true,
        author: {
          select: { id: true, firstname: true, lastname: true, username: true, avatar: true },
        },
        mainCategory: {
          select: { id: true, name: true, emoji: true, lightColor: true, darkColor: true, accentColor: true },
        },
      },
      orderBy: { published_at: 'desc' },
    });

    // Преобразование статуса и приведение к DTO-формату
    const dto = rows.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      cover: a.cover,
      status: a.status.toLowerCase() as ArticleCard['status'], // PUBLISHED -> 'published'
      author: a.author,
      mainCategory: a.mainCategory,
    }));

    // Гарантируем формат возвращаемых данных (валидация ответа)
    return GetArticleCardDTO.array().parse(dto);
  }
}
