import { createHash, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { Profile } from 'passport-google-oauth20';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload, RefreshTokenPayload } from './jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateGoogleUser(profile: Profile) {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value?.toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId }, ...(email ? [{ email }] : [])],
      },
    });

    const { firstname, lastname } = this.extractGoogleName(profile);
    const avatar = profile.photos?.[0]?.value ?? '';

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId,
          email,
          provider: 'google',
          firstname,
          lastname,
          avatar,
        },
      });
    }

    const baseUsername = email?.split('@')[0] ?? `google_${googleId.slice(0, 8)}`;
    const username = await this.generateUniqueUsername(baseUsername);

    return this.prisma.user.create({
      data: {
        username,
        email,
        googleId,
        provider: 'google',
        firstname,
        lastname,
        avatar,
      },
    });
  }

  async validateTikTokAuthCode(code: string) {
    const token = await this.exchangeTikTokAuthCode(code);
    const profile = await this.fetchTikTokProfile(token.access_token);
    const tiktokId = profile.openId ?? token.open_id;

    if (!tiktokId) {
      throw new UnauthorizedException('TikTok authentication failed');
    }

    const displayName = profile.displayName?.trim() || `tiktok_${tiktokId.slice(0, 8)}`;
    const { firstname, lastname } = this.extractTikTokName(displayName);
    const avatar = profile.avatarUrl ?? '';

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ tiktokId }],
      },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          tiktokId,
          provider: 'tiktok',
          firstname,
          lastname,
          avatar,
        },
      });
    }

    const username = await this.generateUniqueUsername(displayName);
    return this.prisma.user.create({
      data: {
        username,
        email: null,
        tiktokId,
        provider: 'tiktok',
        firstname,
        lastname,
        avatar,
      },
    });
  }

  async validateYandexAuthCode(code: string) {
    const token = await this.exchangeYandexAuthCode(code);
    const profile = await this.fetchYandexProfile(token.access_token);
    const yandexId = profile.id;

    if (!yandexId) {
      throw new UnauthorizedException('Yandex authentication failed');
    }

    const email = profile.defaultEmail?.toLowerCase() ?? profile.emails?.[0]?.toLowerCase() ?? null;
    const displayName = profile.realName?.trim() || profile.displayName?.trim() || profile.login?.trim() || `yandex_${yandexId.slice(0, 8)}`;
    const { firstname, lastname } = this.extractYandexName(displayName, profile.firstName, profile.lastName);
    const avatar = this.buildYandexAvatarUrl(profile.defaultAvatarId);

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ yandexId }, ...(email ? [{ email }] : [])],
      },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          yandexId,
          email,
          provider: 'yandex',
          firstname,
          lastname,
          avatar,
        },
      });
    }

    const usernameBase = profile.login?.trim() || email?.split('@')[0] || `yandex_${yandexId.slice(0, 8)}`;
    const username = await this.generateUniqueUsername(usernameBase);
    return this.prisma.user.create({
      data: {
        username,
        email,
        yandexId,
        provider: 'yandex',
        firstname,
        lastname,
        avatar,
      },
    });
  }

  async issueTokens(user: Pick<User, 'id' | 'email'>) {
    const accessTokenPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email ?? null,
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      ...accessTokenPayload,
      type: 'refresh',
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.getJwtSecret(),
        expiresIn: this.getAccessTokenTtlSeconds(),
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: this.getJwtSecret(),
        expiresIn: this.getRefreshTokenTtlSeconds(),
      }),
    ]);

    await this.setRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.getJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        email: true,
        googleId: true,
        tiktokId: true,
        yandexId: true,
        isBanned: true,
        bannedAt: true,
        username: true,
        firstname: true,
        lastname: true,
        avatar: true,
        provider: true,
        refreshTokenHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token not found');
    }
    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    const refreshTokenHash = this.hashToken(refreshToken);
    if (refreshTokenHash !== user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueTokens({ id: user.id, email: user.email });
    return {
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        googleId: user.googleId,
        tiktokId: user.tiktokId,
        yandexId: user.yandexId,
        isBanned: user.isBanned,
        bannedAt: user.bannedAt,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        avatar: user.avatar,
        provider: user.provider,
        refreshTokenHash: user.refreshTokenHash,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }

  async clearRefreshTokenByUserId(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async clearRefreshTokenByToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.getJwtSecret(),
      });
      if (payload.type === 'refresh') {
        await this.clearRefreshTokenByUserId(payload.sub);
      }
    } catch {
      return;
    }
  }

  async findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        googleId: true,
        tiktokId: true,
        yandexId: true,
        isBanned: true,
        bannedAt: true,
        username: true,
        firstname: true,
        lastname: true,
        avatar: true,
        refreshTokenHash: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private extractGoogleName(profile: Profile) {
    const given = profile.name?.givenName?.trim() ?? '';
    const family = profile.name?.familyName?.trim() ?? '';
    if (given || family) return { firstname: given || 'Google', lastname: family || 'User' };

    const display = profile.displayName?.trim() ?? 'Google User';
    const parts = display.split(/\s+/);
    const firstname = parts[0] || 'Google';
    const lastname = parts.slice(1).join(' ') || 'User';
    return { firstname, lastname };
  }

  private extractTikTokName(displayName: string) {
    const cleaned = displayName.trim();
    if (!cleaned) return { firstname: 'TikTok', lastname: 'User' };
    const parts = cleaned.split(/\s+/);
    const firstname = parts[0] || 'TikTok';
    const lastname = parts.slice(1).join(' ') || 'User';
    return { firstname, lastname };
  }

  private extractYandexName(displayName: string, firstName?: string | null, lastName?: string | null) {
    const first = firstName?.trim() ?? '';
    const last = lastName?.trim() ?? '';
    if (first || last) return { firstname: first || 'Yandex', lastname: last || 'User' };

    const cleaned = displayName.trim();
    if (!cleaned) return { firstname: 'Yandex', lastname: 'User' };
    const parts = cleaned.split(/\s+/);
    return {
      firstname: parts[0] || 'Yandex',
      lastname: parts.slice(1).join(' ') || 'User',
    };
  }

  private async exchangeTikTokAuthCode(code: string): Promise<{ access_token: string; open_id?: string }> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
      throw new Error('TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET is not set');
    }

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const payload = (await response.json()) as TikTokTokenResponse;
    if (!response.ok || payload.error || !payload.access_token) {
      throw new UnauthorizedException('TikTok authentication failed');
    }

    return {
      access_token: payload.access_token,
      open_id: payload.open_id,
    };
  }

  private async fetchTikTokProfile(accessToken: string) {
    try {
      const response = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) return {};
      const payload = (await response.json()) as TikTokUserInfoResponse;
      const data = payload.data;
      const user = data?.user ?? data;
      return {
        openId: user?.open_id ?? null,
        displayName: user?.display_name ?? null,
        avatarUrl: user?.avatar_url ?? null,
      };
    } catch {
      return {};
    }
  }

  private async exchangeYandexAuthCode(code: string): Promise<{ access_token: string }> {
    const clientId = process.env.YANDEX_CLIENT_ID;
    const clientSecret = process.env.YANDEX_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('YANDEX_CLIENT_ID or YANDEX_CLIENT_SECRET is not set');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const payload = (await response.json()) as YandexTokenResponse;
    if (!response.ok || payload.error || !payload.access_token) {
      throw new UnauthorizedException('Yandex authentication failed');
    }

    return {
      access_token: payload.access_token,
    };
  }

  private async fetchYandexProfile(accessToken: string) {
    try {
      const response = await fetch('https://login.yandex.ru/info?format=json', {
        headers: {
          Authorization: `OAuth ${accessToken}`,
        },
      });
      if (!response.ok) return {};
      const payload = (await response.json()) as YandexUserInfoResponseRaw;
      return {
        id: payload.id,
        login: payload.login,
        displayName: payload.display_name,
        realName: payload.real_name,
        defaultEmail: payload.default_email,
        emails: payload.emails,
        firstName: payload.first_name,
        lastName: payload.last_name,
        defaultAvatarId: payload.default_avatar_id,
      } as YandexUserInfoResponse;
    } catch {
      return {};
    }
  }

  private buildYandexAvatarUrl(defaultAvatarId?: string | null) {
    if (!defaultAvatarId) return '';
    return `https://avatars.yandex.net/get-yapic/${defaultAvatarId}/islands-200`;
  }

  private async generateUniqueUsername(base: string) {
    const normalized = (base || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 20) || 'user';

    let candidate = normalized;
    let counter = 1;
    while (await this.prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })) {
      candidate = `${normalized}${counter}`;
      counter += 1;
      if (counter > 50) {
        candidate = `${normalized}${Date.now().toString().slice(-6)}`;
        break;
      }
    }
    return candidate;
  }

  private async setRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = this.hashToken(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  private hashToken(token: string) {
    const pepper = process.env.AUTH_REFRESH_TOKEN_PEPPER ?? '';
    return createHash('sha256').update(`${token}${pepper}`).digest('hex');
  }

  private getJwtSecret() {
    const jwtSecret = process.env.AUTH_JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('AUTH_JWT_SECRET is not set');
    }
    return jwtSecret;
  }

  getAccessTokenTtlSeconds() {
    return this.parseTtlSeconds(process.env.AUTH_ACCESS_TOKEN_TTL_SEC, 900);
  }

  getRefreshTokenTtlSeconds() {
    return this.parseTtlSeconds(process.env.AUTH_REFRESH_TOKEN_TTL_SEC, 2592000);
  }

  private parseTtlSeconds(value: string | undefined, fallback: number) {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  }
}

type TikTokTokenResponse = {
  access_token?: string;
  open_id?: string;
  error?: string;
};

type TikTokUserInfoResponse = {
  data?: {
    user?: {
      open_id?: string;
      display_name?: string;
      avatar_url?: string;
    };
    open_id?: string;
    display_name?: string;
    avatar_url?: string;
  };
};

type YandexTokenResponse = {
  access_token?: string;
  error?: string;
};

type YandexUserInfoResponseRaw = {
  id?: string;
  login?: string;
  display_name?: string;
  real_name?: string;
  default_email?: string;
  emails?: string[];
  first_name?: string;
  last_name?: string;
  default_avatar_id?: string;
  [key: string]: unknown;
};

type YandexUserInfoResponse = {
  id?: string;
  login?: string;
  displayName?: string;
  realName?: string;
  defaultEmail?: string;
  emails?: string[];
  firstName?: string;
  lastName?: string;
  defaultAvatarId?: string;
};
