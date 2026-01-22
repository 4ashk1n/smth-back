import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ArticleListQuerySchema, CreateArticleSchema, UpdateArticleSchema } from "@smth/shared";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ArticleService } from "./article.service";

type ListQuery = z.infer<typeof ArticleListQuerySchema>;
type CreateDto = z.infer<typeof CreateArticleSchema>;
type UpdateDto = z.infer<typeof UpdateArticleSchema>;

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;
@Controller("articles")
export class ArticleController {
  constructor(private readonly articleService: ArticleService) { }

  @Get()
  list(@Query(new ZodValidationPipe(asZodType(ArticleListQuerySchema))) query: ListQuery) {
    return this.articleService.list(query);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.articleService.getById(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(asZodType(CreateArticleSchema))) dto: CreateDto) {
    return this.articleService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(asZodType(UpdateArticleSchema))) dto: UpdateDto) {
    return this.articleService.update(id, dto);
  }
}

