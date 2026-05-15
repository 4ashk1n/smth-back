import { PrismaService } from '../../src/prisma/prisma.service';
import { UserRole } from '@prisma/client';

type CreateUserParams = {
  email?: string | null;
  username?: string;
  firstname?: string;
  lastname?: string;
  role?: UserRole;
};

export async function createUser(prisma: PrismaService, params: CreateUserParams = {}) {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const username = params.username ?? `user_${suffix}`;
  const email = params.email === undefined ? `${username}@e2e.local` : params.email;

  return prisma.user.create({
    data: {
      username,
      email,
      firstname: params.firstname ?? 'E2E',
      lastname: params.lastname ?? 'User',
      role: params.role ?? 'user',
      provider: 'local',
      avatar: '',
    },
  });
}
