import { randomUUID } from 'node:crypto';
import { BadRequestException, Controller, Get, Post, Request, Response, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  AuthLogoutResponseSchema,
  AuthMeResponseSchema,
  AuthRefreshResponseSchema,
  type AuthLogoutResponse,
  type AuthMeResponse,
  type AuthRefreshResponse,
} from '@smth/shared';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE, getAuthCookieOptions, REFRESH_TOKEN_COOKIE } from './auth.constants';

const TIKTOK_OAUTH_STATE_COOKIE = 'tiktok_oauth_state';
const YANDEX_OAUTH_STATE_COOKIE = 'yandex_oauth_state';

type RequestWithUser = ExpressRequest & {
  user?: {
    id: string;
    email: string | null;
    role: "user" | "moderator" | "admin";
    googleId: string | null;
    tiktokId: string | null;
    yandexId: string | null;
    isBanned: boolean;
    bannedAt: Date | null;
    username: string;
    firstname: string;
    lastname: string;
    avatar: string;
    refreshTokenHash: string | null;
    provider: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Request() req: RequestWithUser,
    @Response() res: ExpressResponse,
  ) {
    if (!req.user) {
      throw new UnauthorizedException('Google authentication failed');
    }

    const tokens = await this.authService.issueTokens({
      id: req.user.id,
      email: req.user.email,
    });
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const redirect = process.env.AUTH_GOOGLE_SUCCESS_REDIRECT;
    if (redirect) {
      return res.redirect(redirect);
    }
    return res.json(AuthMeResponseSchema.parse({ success: true, data: req.user }));
  }

  @Get('tiktok')
  async tiktokAuth(@Response() res: ExpressResponse) {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const callbackUrl = process.env.TIKTOK_CALLBACK_URL;
    if (!clientKey || !callbackUrl) {
      throw new BadRequestException('TikTok OAuth is not configured');
    }

    const state = randomUUID();
    res.cookie(TIKTOK_OAUTH_STATE_COOKIE, state, getAuthCookieOptions(10 * 60 * 1000));

    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: 'code',
      scope: process.env.TIKTOK_SCOPE ?? 'user.info.basic',
      redirect_uri: callbackUrl,
      state,
    });

    return res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`);
  }

  @Get('tiktok/callback')
  async tiktokAuthCallback(
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
  ) {
    const code = this.readStringQuery(req.query?.code);
    const state = this.readStringQuery(req.query?.state);
    const error = this.readStringQuery(req.query?.error);
    const errorDescription = this.readStringQuery(req.query?.error_description);
    const expectedState = req.cookies?.[TIKTOK_OAUTH_STATE_COOKIE];

    res.clearCookie(TIKTOK_OAUTH_STATE_COOKIE, getAuthCookieOptions(0));

    if (error) {
      throw new UnauthorizedException(errorDescription ?? `TikTok authentication failed: ${error}`);
    }
    if (!code || !state || !expectedState || state !== expectedState) {
      throw new UnauthorizedException('TikTok authentication failed');
    }

    const user = await this.authService.validateTikTokAuthCode(code);
    const tokens = await this.authService.issueTokens({
      id: user.id,
      email: user.email,
    });
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const redirect = process.env.AUTH_TIKTOK_SUCCESS_REDIRECT ?? process.env.AUTH_GOOGLE_SUCCESS_REDIRECT;
    if (redirect) {
      return res.redirect(redirect);
    }
    return res.json(AuthMeResponseSchema.parse({ success: true, data: user }));
  }

  @Get('yandex')
  async yandexAuth(@Response() res: ExpressResponse) {
    const clientId = process.env.YANDEX_CLIENT_ID;
    const callbackUrl = process.env.YANDEX_CALLBACK_URL;
    if (!clientId || !callbackUrl) {
      throw new BadRequestException('Yandex OAuth is not configured');
    }

    const state = randomUUID();
    res.cookie(YANDEX_OAUTH_STATE_COOKIE, state, getAuthCookieOptions(10 * 60 * 1000));

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: process.env.YANDEX_SCOPE ?? 'login:email login:info',
      state,
    });

    return res.redirect(`https://oauth.yandex.ru/authorize?${params.toString()}`);
  }

  @Get('yandex/callback')
  async yandexAuthCallback(
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
  ) {
    const code = this.readStringQuery(req.query?.code);
    const state = this.readStringQuery(req.query?.state);
    const error = this.readStringQuery(req.query?.error);
    const expectedState = req.cookies?.[YANDEX_OAUTH_STATE_COOKIE];

    res.clearCookie(YANDEX_OAUTH_STATE_COOKIE, getAuthCookieOptions(0));

    if (error) {
      throw new UnauthorizedException(`Yandex authentication failed: ${error}`);
    }
    if (!code || !state || !expectedState || state !== expectedState) {
      throw new UnauthorizedException('Yandex authentication failed');
    }

    const user = await this.authService.validateYandexAuthCode(code);
    const tokens = await this.authService.issueTokens({
      id: user.id,
      email: user.email,
    });
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const redirect = process.env.AUTH_YANDEX_SUCCESS_REDIRECT ?? process.env.AUTH_GOOGLE_SUCCESS_REDIRECT;
    if (redirect) {
      return res.redirect(redirect);
    }
    return res.json(AuthMeResponseSchema.parse({ success: true, data: user }));
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Request() req: RequestWithUser): Promise<AuthMeResponse> {
    if (!req.user) {
      throw new UnauthorizedException('User not found');
    }
    return AuthMeResponseSchema.parse({ success: true, data: req.user });
  }

  @Post('refresh')
  async refresh(@Request() req: ExpressRequest, @Response() res: ExpressResponse): Promise<ExpressResponse<AuthRefreshResponse>> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const { user, tokens } = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return res.json(AuthRefreshResponseSchema.parse({ success: true, data: user }));
  }

  @Post('logout')
  async logout(@Request() req: ExpressRequest, @Response() res: ExpressResponse): Promise<ExpressResponse<AuthLogoutResponse>> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      await this.authService.clearRefreshTokenByToken(refreshToken);
    }

    this.clearAuthCookies(res);
    return res.json(AuthLogoutResponseSchema.parse({ success: true, data: { success: true } }));
  }

  private setAuthCookies(res: ExpressResponse, accessToken: string, refreshToken: string) {
    const accessMaxAgeMs = this.authService.getAccessTokenTtlSeconds() * 1000;
    const refreshMaxAgeMs = this.authService.getRefreshTokenTtlSeconds() * 1000;

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getAuthCookieOptions(accessMaxAgeMs));
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getAuthCookieOptions(refreshMaxAgeMs));
  }

  private clearAuthCookies(res: ExpressResponse) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, getAuthCookieOptions(0));
    res.clearCookie(REFRESH_TOKEN_COOKIE, getAuthCookieOptions(0));
  }

  private readStringQuery(value: unknown): string | null {
    if (typeof value === 'string') return value;
    return null;
  }
}

