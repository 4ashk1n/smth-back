import { Injectable, NotFoundException } from "@nestjs/common";
import type { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserSchema, UpdateUserSchema, UserDtoSchema, type UserDto } from "./user.schemas";

type CreateDto = z.infer<typeof CreateUserSchema>;
type UpdateDto = z.infer<typeof UpdateUserSchema>;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.user.findMany({
      select: { id: true, username: true, firstname: true, lastname: true, avatar: true },
      orderBy: { createdAt: "desc" },
    });

    const items: UserDto[] = rows.map((row) => ({
      id: row.id,
      username: row.username,
      firstname: row.firstname,
      lastname: row.lastname,
      avatar: row.avatar,
    }));

    return { success: true, data: UserDtoSchema.array().parse(items) };
  }

  async getById(id: string) {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, firstname: true, lastname: true, avatar: true },
    });
    if (!row) throw new NotFoundException("User not found");

    const dto: UserDto = {
      id: row.id,
      username: row.username,
      firstname: row.firstname,
      lastname: row.lastname,
      avatar: row.avatar,
    };

    return { success: true, data: UserDtoSchema.parse(dto) };
  }

  async create(dto: CreateDto) {
    const created = await this.prisma.user.create({
      data: {
        username: dto.username,
        firstname: dto.firstname,
        lastname: dto.lastname,
        avatar: dto.avatar,
      },
      select: { id: true, username: true, firstname: true, lastname: true, avatar: true },
    });

    const data: UserDto = {
      id: created.id,
      username: created.username,
      firstname: created.firstname,
      lastname: created.lastname,
      avatar: created.avatar,
    };

    return { success: true, data: UserDtoSchema.parse(data) };
  }

  async update(id: string, dto: UpdateDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("User not found");

    const data: Partial<CreateDto> = {};
    if (dto.username !== undefined) data.username = dto.username;
    if (dto.firstname !== undefined) data.firstname = dto.firstname;
    if (dto.lastname !== undefined) data.lastname = dto.lastname;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, firstname: true, lastname: true, avatar: true },
    });

    const result: UserDto = {
      id: updated.id,
      username: updated.username,
      firstname: updated.firstname,
      lastname: updated.lastname,
      avatar: updated.avatar,
    };

    return { success: true, data: UserDtoSchema.parse(result) };
  }

  async remove(id: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("User not found");

    const deleted = await this.prisma.user.delete({
      where: { id },
      select: { id: true },
    });

    return { success: true, data: deleted };
  }
}
