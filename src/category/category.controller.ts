import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import { CreateCategorySchema, UpdateCategorySchema } from "@smth/shared";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CategoryService } from "./category.service";
import { CategoryListResponse, CategoryResponse, CreateCategoryDto, DeleteResponse, UpdateCategoryDto } from "./category.swagger";

type CreateDto = z.infer<typeof CreateCategorySchema>;
type UpdateDto = z.infer<typeof UpdateCategorySchema>;

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

@Controller("categories")
@ApiTags("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOkResponse({ type: CategoryListResponse })
  list() {
    return this.categoryService.list();
  }

  @Get(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ type: CategoryResponse })
  getById(@Param("id") id: string) {
    return this.categoryService.getById(id);
  }

  @Post()
  @ApiBody({ type: CreateCategoryDto })
  @ApiCreatedResponse({ type: CategoryResponse })
  create(@Body(new ZodValidationPipe(asZodType(CreateCategorySchema))) dto: CreateDto) {
    return this.categoryService.create(dto);
  }

  @Patch(":id")
  @ApiParam({ name: "id", type: String })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOkResponse({ type: CategoryResponse })
  update(@Param("id") id: string, @Body(new ZodValidationPipe(asZodType(UpdateCategorySchema))) dto: UpdateDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ type: DeleteResponse })
  remove(@Param("id") id: string) {
    return this.categoryService.remove(id);
  }
}
