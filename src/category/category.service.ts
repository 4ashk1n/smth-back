import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CategoryListResponseSchema,
  CategoryResponseSchema,
  CategorySchema,
  CreateCategoryResponseSchema,
  CreateCategorySchema,
  DeleteCategoryResponseSchema,
  UpdateCategoryResponseSchema,
  UpdateCategorySchema,
  type CategoryListResponse,
  type CategoryResponse,
  type CreateCategoryResponse,
  type DeleteCategoryResponse,
  type UpdateCategoryResponse,
} from "@smth/shared";
import type { z } from "zod";
import { PrismaMapper } from "../common/utils/prisma-mapper.util";
import { PrismaService } from "../prisma/prisma.service";

type CategoryDto = z.infer<typeof CategorySchema>;
type CreateDto = z.infer<typeof CreateCategorySchema>;
type UpdateDto = z.infer<typeof UpdateCategorySchema>;

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CategoryListResponse> {
    const rows = await this.prisma.category.findMany({
      select: { id: true, name: true, emoji: true, colors: true, createdAt: true, updatedAt: true },
      orderBy: { name: "asc" },
    });

    const items: CategoryDto[] = rows.map((row) => PrismaMapper.toCategoryDTO(row));
    const parsed = CategorySchema.array().parse(items);

    return CategoryListResponseSchema.parse({ success: true, data: parsed });
  }

  async getById(id: string): Promise<CategoryResponse> {
    const row = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, emoji: true, colors: true, createdAt: true, updatedAt: true },
    });
    if (!row) throw new NotFoundException("Category not found");

    const dto = PrismaMapper.toCategoryDTO(row);
    return CategoryResponseSchema.parse({ success: true, data: CategorySchema.parse(dto) });
  }

  async create(dto: CreateDto): Promise<CreateCategoryResponse> {
    const created = await this.prisma.category.create({
      data: {
        name: dto.name,
        emoji: dto.emoji,
        colors: dto.colors as any,
      },
      select: { id: true, name: true, emoji: true, colors: true, createdAt: true, updatedAt: true },
    });

    const data = PrismaMapper.toCategoryDTO(created);
    return CreateCategoryResponseSchema.parse({ success: true, data: CategorySchema.parse(data) });
  }

  async update(id: string, dto: UpdateDto): Promise<UpdateCategoryResponse> {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Category not found");

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.emoji !== undefined) data.emoji = dto.emoji;
    if (dto.colors !== undefined) data.colors = dto.colors;

    const updated = await this.prisma.category.update({
      where: { id },
      data,
      select: { id: true, name: true, emoji: true, colors: true, createdAt: true, updatedAt: true },
    });

    const mapped = PrismaMapper.toCategoryDTO(updated);
    return UpdateCategoryResponseSchema.parse({ success: true, data: CategorySchema.parse(mapped) });
  }

  async remove(id: string): Promise<DeleteCategoryResponse> {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Category not found");

    const deleted = await this.prisma.category.delete({
      where: { id },
      select: { id: true },
    });

    return DeleteCategoryResponseSchema.parse({ success: true, data: deleted });
  }
}
