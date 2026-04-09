import { Prisma } from '@prisma/client';

type PrismaCategory = Prisma.CategoryGetPayload<object>;

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

  static toPrismaStatus(status: string): 'published' | 'draft' | 'archived' | 'review' {
    return status.toLowerCase() as 'published' | 'draft' | 'archived' | 'review';
  }
}
