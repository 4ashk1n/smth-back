import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import {
  type CreateCategory,
  type CategoryListResponse,
  type CategoryResponse,
  type CreateCategoryResponse,
  CreateCategorySchema,
  type DeleteCategoryResponse,
  type UpdateCategory,
  type UpdateCategoryResponse,
  UpdateCategorySchema,
} from "@smth/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CategoryService } from "./category.service";


@Controller("categories")
@ApiTags("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOkResponse({ description: "CategoryListResponse from @smth/shared" })
  list(): Promise<CategoryListResponse> {
    return this.categoryService.list();
  }

  @Get(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "CategoryResponse from @smth/shared" })
  getById(@Param("id") id: string): Promise<CategoryResponse> {
    return this.categoryService.getById(id);
  }

  @Post()
  @ApiBody({ description: "CreateCategorySchema from @smth/shared" })
  @ApiCreatedResponse({ description: "CreateCategoryResponse from @smth/shared" })
  create(@Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategory): Promise<CreateCategoryResponse> {
    return this.categoryService.create(dto);
  }

  @Patch(":id")
  @ApiParam({ name: "id", type: String })
  @ApiBody({ description: "UpdateCategorySchema from @smth/shared" })
  @ApiOkResponse({ description: "UpdateCategoryResponse from @smth/shared" })
  update(@Param("id") id: string, @Body(new ZodValidationPipe(UpdateCategorySchema)) dto: UpdateCategory): Promise<UpdateCategoryResponse> {
    return this.categoryService.update(id, dto);
  }

  @Delete(":id")
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ description: "DeleteCategoryResponse from @smth/shared" })
  remove(@Param("id") id: string): Promise<DeleteCategoryResponse> {
    return this.categoryService.remove(id);
  }
}



