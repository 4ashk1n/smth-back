import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  SearchArticlesQuerySchema,
  SearchCategoriesQuerySchema,
  SearchUsersQuerySchema,
  type SearchArticlesResponse,
  type SearchCategoriesResponse,
  type SearchUsersResponse
} from "@smth/shared";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SearchService } from "./search.service";

type SearchUsersQuery = z.infer<typeof SearchUsersQuerySchema>;
type SearchArticlesQuery = z.infer<typeof SearchArticlesQuerySchema>;
type SearchCategoriesQuery = z.infer<typeof SearchCategoriesQuerySchema>;

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get("users")
  @ApiQuery({ name: "q", required: true, type: String })
  @ApiQuery({ name: "page", required: false, type: Number, default: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, default: 10 })
  @ApiOkResponse({ description: "SearchUsersResponse from @smth/shared" })
  searchUsers(
    @Query(new ZodValidationPipe(asZodType(SearchUsersQuerySchema))) query: SearchUsersQuery,
  ): Promise<SearchUsersResponse> {
    return this.searchService.searchUsers(query);
  }

  @Get("articles")
  @ApiQuery({ name: "q", required: true, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "categoryIds",
    required: false,
    type: String,
    isArray: true,
    description: "Optional category filter. Repeat query param: ?categoryIds=id1&categoryIds=id2",
  })
  @ApiOkResponse({ description: "SearchArticlesResponse from @smth/shared" })
  searchArticles(
    @Query(new ZodValidationPipe(asZodType(SearchArticlesQuerySchema))) query: SearchArticlesQuery,
  ): Promise<SearchArticlesResponse> {
    return this.searchService.searchArticles(query);
  }

  @Get("categories")
  @ApiQuery({ name: "q", required: true, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ description: "SearchCategoriesResponse from @smth/shared" })
  searchCategories(
    @Query(new ZodValidationPipe(asZodType(SearchCategoriesQuerySchema))) query: SearchCategoriesQuery,
  ): Promise<SearchCategoriesResponse> {
    return this.searchService.searchCategories(query);
  }
}
