import { Injectable, NotFoundException } from "@nestjs/common";
import { CategorySchema, CreateCategorySchema, UpdateCategorySchema } from "@smth/shared";
import type { z } from "zod";
import { PrismaMapper } from "../common/utils/prisma-mapper.util";
import { PrismaService } from "../prisma/prisma.service";

type CategoryDto = z.infer<typeof CategorySchema>;
type CreateDto = z.infer<typeof CreateCategorySchema>;
type UpdateDto = z.infer<typeof UpdateCategorySchema>;

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.category.findMany({
      select: { id: true, name: true, emoji: true, colors: true, createdAt: true, updatedAt: true },
      orderBy: { name: "asc" },
    });

    const items: CategoryDto[] = rows.map((row) => PrismaMapper.toCategoryDTO(row));
    const parsed = CategorySchema.array().parse(items);

    return { success: true, data: parsed };
  }

  async getById(id: string) {
    const row = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, emoji: true, colors: true, createdAt: true, updatedAt: true },
    });
    if (!row) throw new NotFoundException("Category not found");

    const dto = PrismaMapper.toCategoryDTO(row);
    return { success: true, data: CategorySchema.parse(dto) };
  }

  async create(dto: CreateDto) {
    const created = await this.prisma.category.create({
      data: {
        name: dto.name,
        emoji: dto.emoji,
        colors: dto.colors,
      },
      select: { id: true, name: true, emoji: true, colors: true, createdAt: true, updatedAt: true },
    });

    const data = PrismaMapper.toCategoryDTO(created);
    return { success: true, data: CategorySchema.parse(data) };
  }

  async update(id: string, dto: UpdateDto) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Category not found");

    const data: Partial<CreateDto> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.emoji !== undefined) data.emoji = dto.emoji;
    if (dto.colors !== undefined) data.colors = dto.colors;

    const updated = await this.prisma.category.update({
      where: { id },
      data,
      select: { id: true, name: true, emoji: true, colors: true, createdAt: true, updatedAt: true },
    });

    const mapped = PrismaMapper.toCategoryDTO(updated);
    return { success: true, data: CategorySchema.parse(mapped) };
  }

  async remove(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Category not found");

    const deleted = await this.prisma.category.delete({
      where: { id },
      select: { id: true },
    });

    return { success: true, data: deleted };
  }
}
