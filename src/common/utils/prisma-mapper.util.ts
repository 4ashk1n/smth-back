import { Prisma } from '@prisma/client';
import type { Article, Category } from '@smth/shared';


// Используем Prisma payload types
type PrismaCategory = Prisma.CategoryGetPayload<object>;

type PrismaArticleWithRelations = Prisma.ArticleGetPayload<{
  include: {
    categories: true;
    mainCategory: true;
  };
}>;


export class PrismaMapper {
  // Category: Prisma → Shared
  static toCategoryDTO(prismaCategory: PrismaCategory): Category {
    return {
      id: prismaCategory.id,
      name: prismaCategory.name,
      emoji: prismaCategory.emoji,
      colors: {
        lightColor: (prismaCategory.colors as { lightColor: string, darkColor: string, accentColor: string } | undefined)?.lightColor || "#ffffff",
        darkColor: (prismaCategory.colors as { lightColor: string, darkColor: string, accentColor: string } | undefined)?.darkColor || "#000000",
        accentColor: (prismaCategory.colors as { lightColor: string, darkColor: string, accentColor: string } | undefined)?.accentColor || "#cccccc",
      },
    };
  }

  // Article: Prisma → Shared (full)
  static toArticleDTO(prismaArticle: PrismaArticleWithRelations): Article {
    return {
      id: prismaArticle.id,
      title: prismaArticle.title,
      description: prismaArticle.description || '',
      mainCategory: prismaArticle.mainCategoryId,
      categories: prismaArticle.categories.map(cat => this.toCategoryDTO(cat).id),
      status: prismaArticle.status.toLowerCase() as 'published' | 'draft' | 'archived' | 'review',
      content: prismaArticle.content as any,
    };
  }

  // Article: Prisma → Shared (meta only)
  static toArticleMeta(prismaArticle: PrismaArticleWithRelations) {
    return {
      id: prismaArticle.id,
      title: prismaArticle.title,
      description: prismaArticle.description || '',
      mainCategory: prismaArticle.mainCategoryId,
      categories: prismaArticle.categories.map(cat => cat.id),
      status: prismaArticle.status.toLowerCase() as 'published' | 'draft' | 'archived' | 'review',
    };
  }

  // Status: Shared → Prisma (просто uppercase строка)
  static toPrismaStatus(status: string): 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'REVIEW' {
    return status.toUpperCase() as 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'REVIEW';
  }
}