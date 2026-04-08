import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from "@nestjs/common";
import type {
  AiSuggestionMode,
  AiSuggestionRequest,
  AiSuggestionsResponse,
  AiSuggestionUpstreamRequest,
} from "@smth/shared";
import { AiSuggestionsResponseSchema } from "@smth/shared";
import { ZodError } from "zod";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private static readonly DEFAULT_BASE_URL = "http://localhost:8000";
  private static readonly DEFAULT_TIMEOUT_MS = 60000;

  constructor(private readonly prisma: PrismaService) {}

  async getSuggestions(kind: AiSuggestionMode, userId: string, request: AiSuggestionRequest): Promise<AiSuggestionsResponse> {
    const article = await this.loadDraftForSuggestions(userId, request.draftId);

    const url = this.getBaseUrl() + `/api/v1/suggestions/${kind}`;
    const controller = new AbortController();
    const timeoutMs = this.getTimeoutMs();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(article),
        signal: controller.signal,
      });

      const rawBody = await response.text();
      const payload = this.parseJson(rawBody);

      if (!response.ok) {
        this.throwUpstreamError(response.status, payload);
      }

      return AiSuggestionsResponseSchema.parse(payload);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof GatewayTimeoutException) throw error;
      if (error instanceof BadGatewayException) throw error;

      if (this.isAbortError(error)) {
        throw new GatewayTimeoutException("AI module request timed out");
      }

      if (error instanceof ZodError) {
        this.logger.error("AI module returned invalid schema", error.issues);
        throw new BadGatewayException("AI module returned invalid response");
      }

      this.logger.error("AI module request failed", error as Error);
      throw new BadGatewayException("AI module is unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async loadDraftForSuggestions(userId: string, articleId: string): Promise<AiSuggestionUpstreamRequest> {
    const article = await this.prisma.article.findFirst({
      where: {
        id: articleId,
        authorId: userId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        authorId: true,
        mainCategoryId: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        categories: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!article) {
      throw new ForbiddenException("You can request suggestions only for your own draft");
    }

    if (article.status !== "draft") {
      throw new BadRequestException("Suggestions are available only for draft articles");
    }

    return {
      id: article.id,
      title: article.title,
      description: article.description,
      content: article.content as AiSuggestionUpstreamRequest["content"],
      authorId: article.authorId,
      mainCategoryId: article.mainCategoryId,
      categories: article.categories.map((category) => category.id),
      status: article.status,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }

  private getBaseUrl() {
    return (process.env.AI_MODULE_BASE_URL ?? AiService.DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  private getTimeoutMs() {
    const raw = process.env.AI_MODULE_TIMEOUT_MS;
    if (!raw) return AiService.DEFAULT_TIMEOUT_MS;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return AiService.DEFAULT_TIMEOUT_MS;
    return parsed;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const apiKey = process.env.AI_MODULE_API_KEY?.trim();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    return headers;
  }

  private parseJson(raw: string): unknown {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  private throwUpstreamError(status: number, payload: unknown): never {
    if (status === 422 || status === 400) {
      throw new BadRequestException({
        message: "AI module validation failed",
        upstream: payload,
      });
    }

    if (status === 408 || status === 504) {
      throw new GatewayTimeoutException("AI module timed out");
    }

    throw new BadGatewayException({
      message: "AI module request failed",
      upstreamStatus: status,
      upstream: payload,
    });
  }

  private isAbortError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    return "name" in error && (error as { name?: string }).name === "AbortError";
  }
}
