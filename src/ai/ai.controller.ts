import { Body, Controller, Post, Request, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBody, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AiSuggestionRequestSchema } from "@smth/shared";
import type { AiSuggestionRequest, AiSuggestionsResponse } from "@smth/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { RequestWithUserId } from "../common/types/request.types";
import { AiService } from "./ai.service";


@ApiTags("ai")
@Controller("ai/suggestions")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("layout")
  @UseGuards(AuthGuard("jwt"))
  @ApiBody({ description: "AiSuggestionRequestSchema ({ draftId }) from @smth/shared" })
  @ApiOkResponse({ description: "AI layout suggestions response" })
  suggestLayout(
    @Body(new ZodValidationPipe(AiSuggestionRequestSchema)) body: AiSuggestionRequest,
    @Request() req: RequestWithUserId,
  ): Promise<AiSuggestionsResponse> {
    const userId = this.getRequiredUserId(req);
    return this.aiService.getSuggestions("layout", userId, body);
  }

  @Post("text")
  @UseGuards(AuthGuard("jwt"))
  @ApiBody({ description: "AiSuggestionRequestSchema ({ draftId }) from @smth/shared" })
  @ApiOkResponse({ description: "AI text suggestions response" })
  suggestText(
    @Body(new ZodValidationPipe(AiSuggestionRequestSchema)) body: AiSuggestionRequest,
    @Request() req: RequestWithUserId,
  ): Promise<AiSuggestionsResponse> {
    const userId = this.getRequiredUserId(req);
    return this.aiService.getSuggestions("text", userId, body);
  }

  @Post("all")
  @UseGuards(AuthGuard("jwt"))
  @ApiBody({ description: "AiSuggestionRequestSchema ({ draftId }) from @smth/shared" })
  @ApiOkResponse({ description: "AI full suggestions response" })
  suggestAll(
    @Body(new ZodValidationPipe(AiSuggestionRequestSchema)) body: AiSuggestionRequest,
    @Request() req: RequestWithUserId,
  ): Promise<AiSuggestionsResponse> {
    const userId = this.getRequiredUserId(req);
    return this.aiService.getSuggestions("all", userId, body);
  }

  private getRequiredUserId(req: RequestWithUserId) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException("Unauthorized");
    return userId;
  }
}




