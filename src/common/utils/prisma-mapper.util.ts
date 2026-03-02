import { Prisma } from '@prisma/client';

type PrismaCategory = Prisma.CategoryGetPayload<object>;

type PrismaArticleWithRelations = Prisma.ArticleGetPayload<{
  include: {
    categories: true;
    mainCategory: true;
  };
}>;

export class PrismaMapper {
  static toCategoryDTO(prismaCategory: PrismaCategory) {
    return {
      id: prismaCategory.id,
      name: prismaCategory.name,
      emoji: prismaCategory.emoji,
      colors: {
        lightColor: (prismaCategory.colors as { lightColor?: string } | undefined)?.lightColor || '#ffffff',
        darkColor: (prismaCategory.colors as { darkColor?: string } | undefined)?.darkColor || '#000000',
        accentColor: (prismaCategory.colors as { accentColor?: string } | undefined)?.accentColor || '#cccccc',
      },
      createdAt: (prismaCategory as any).createdAt,
      updatedAt: (prismaCategory as any).updatedAt,
    };
  }

  static toArticleDTO(prismaArticle: PrismaArticleWithRelations) {
    return {
      id: prismaArticle.id,
      title: prismaArticle.title,
      description: prismaArticle.description,
      content: prismaArticle.content as any,
      authorId: prismaArticle.authorId,
      mainCategoryId: prismaArticle.mainCategoryId,
      status: prismaArticle.status,
      publishedAt: prismaArticle.publishedAt,
      createdAt: prismaArticle.createdAt,
      updatedAt: prismaArticle.updatedAt,
      categories: prismaArticle.categories.map((cat) => cat.id),
    };
  }

  static toArticleMeta(prismaArticle: PrismaArticleWithRelations) {
    return {
      id: prismaArticle.id,
      title: prismaArticle.title,
      description: prismaArticle.description,
      mainCategoryId: prismaArticle.mainCategoryId,
      categories: prismaArticle.categories.map((cat) => cat.id),
      status: prismaArticle.status,
    };
  }

  static toPrismaStatus(status: string): 'published' | 'draft' | 'archived' | 'review' {
    return status.toLowerCase() as 'published' | 'draft' | 'archived' | 'review';
  }
}
