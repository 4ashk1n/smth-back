import { Injectable, NotFoundException } from "@nestjs/common";
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
}
