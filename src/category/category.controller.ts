import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CreateCategorySchema, UpdateCategorySchema } from "@smth/shared";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CategoryService } from "./category.service";

type CreateDto = z.infer<typeof CreateCategorySchema>;
type UpdateDto = z.infer<typeof UpdateCategorySchema>;

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

@Controller("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  list() {
    return this.categoryService.list();
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.categoryService.getById(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(asZodType(CreateCategorySchema))) dto: CreateDto) {
    return this.categoryService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(asZodType(UpdateCategorySchema))) dto: UpdateDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.categoryService.remove(id);
  }
}
