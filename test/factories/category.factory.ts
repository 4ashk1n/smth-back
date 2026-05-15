import { PrismaService } from '../../src/prisma/prisma.service';

type CreateCategoryParams = {
  name?: string;
  emoji?: string;
};

export async function createCategory(prisma: PrismaService, params: CreateCategoryParams = {}) {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return prisma.category.create({
    data: {
      name: params.name ?? `Category ${suffix}`,
      emoji: params.emoji ?? 'book',
      colors: ['#111111', '#eeeeee'],
    },
  });
}
