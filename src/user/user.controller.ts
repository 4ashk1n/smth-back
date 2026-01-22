import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateUserSchema, UpdateUserSchema } from "./user.schemas";
import { UserService } from "./user.service";

type CreateDto = z.infer<typeof CreateUserSchema>;
type UpdateDto = z.infer<typeof UpdateUserSchema>;

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  list() {
    return this.userService.list();
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.userService.getById(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(asZodType(CreateUserSchema))) dto: CreateDto) {
    return this.userService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(asZodType(UpdateUserSchema))) dto: UpdateDto) {
    return this.userService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.userService.remove(id);
  }
}
