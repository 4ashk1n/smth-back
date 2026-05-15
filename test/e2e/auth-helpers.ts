import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createUser } from '../factories/user.factory';

export async function createAuthCookies(
  authService: AuthService,
  prisma: PrismaService,
  role: 'user' | 'moderator' | 'admin' = 'user',
) {
  const user = await createUser(prisma, { role });
  const tokens = await authService.issueTokens({ id: user.id, email: user.email });

  return {
    user,
    cookies: [`access_token=${tokens.accessToken}`, `refresh_token=${tokens.refreshToken}`],
    refreshCookie: `refresh_token=${tokens.refreshToken}`,
  };
}
