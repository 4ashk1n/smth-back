import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  SearchArticlesQuerySchema,
  SearchCategoriesQuerySchema,
  SearchUsersQuerySchema,
  type SearchArticlesQuery,
  type SearchArticlesResponse,
  type SearchCategoriesQuery,
  type SearchCategoriesResponse,
  type SearchUsersQuery,
  type SearchUsersResponse
} from "@smth/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SearchService } from "./search.service";


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
    @Query(new ZodValidationPipe(SearchUsersQuerySchema)) query: SearchUsersQuery,
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
    @Query(new ZodValidationPipe(SearchArticlesQuerySchema)) query: SearchArticlesQuery,
  ): Promise<SearchArticlesResponse> {
    return this.searchService.searchArticles(query);
  }

  @Get("categories")
  @ApiQuery({ name: "q", required: true, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ description: "SearchCategoriesResponse from @smth/shared" })
  searchCategories(
    @Query(new ZodValidationPipe(SearchCategoriesQuerySchema)) query: SearchCategoriesQuery,
  ): Promise<SearchCategoriesResponse> {
    return this.searchService.searchCategories(query);
  }
}



