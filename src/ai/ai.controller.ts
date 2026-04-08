import { Body, Controller, Post, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AiSuggestionRequestSchema } from "@smth/shared";
import type { AiSuggestionRequest, AiSuggestionsResponse } from "@smth/shared";
import type { Request as ExpressRequest } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AiService } from "./ai.service";

type RequestWithUser = ExpressRequest & {
  user?: {
    id: string;
  };
};

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

@ApiTags("ai")
@Controller("ai/suggestions")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("layout")
  @UseGuards(AuthGuard("jwt"))
  @ApiBody({ description: "AiSuggestionRequestSchema ({ draftId }) from @smth/shared" })
  @ApiOkResponse({ description: "AI layout suggestions response" })
  suggestLayout(
    @Body(new ZodValidationPipe(asZodType(AiSuggestionRequestSchema))) body: AiSuggestionRequest,
    @Request() req: RequestWithUser,
  ): Promise<AiSuggestionsResponse> {
    const userId = this.getRequiredUserId(req);
    return this.aiService.getSuggestions("layout", userId, body);
  }

  @Post("text")
  @UseGuards(AuthGuard("jwt"))
  @ApiBody({ description: "AiSuggestionRequestSchema ({ draftId }) from @smth/shared" })
  @ApiOkResponse({ description: "AI text suggestions response" })
  suggestText(
    @Body(new ZodValidationPipe(asZodType(AiSuggestionRequestSchema))) body: AiSuggestionRequest,
    @Request() req: RequestWithUser,
  ): Promise<AiSuggestionsResponse> {
    const userId = this.getRequiredUserId(req);
    return this.aiService.getSuggestions("text", userId, body);
  }

  @Post("all")
  @UseGuards(AuthGuard("jwt"))
  @ApiBody({ description: "AiSuggestionRequestSchema ({ draftId }) from @smth/shared" })
  @ApiOkResponse({ description: "AI full suggestions response" })
  suggestAll(
    @Body(new ZodValidationPipe(asZodType(AiSuggestionRequestSchema))) body: AiSuggestionRequest,
    @Request() req: RequestWithUser,
  ): Promise<AiSuggestionsResponse> {
    const userId = this.getRequiredUserId(req);
    return this.aiService.getSuggestions("all", userId, body);
  }

  private getRequiredUserId(req: RequestWithUser) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return userId;
  }
}
