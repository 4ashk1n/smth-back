import { Controller, Get, Post, Request, Response, UnauthorizedException, UseGuards } from '@nestjs/common';
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

type RequestWithUser = ExpressRequest & {
  user?: {
    id: string;
    email: string | null;
    role: "user" | "moderator" | "admin";
    googleId: string | null;
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
}
