
import { Injectable } from '@nestjs/common';
import type { Profile } from 'passport-google-oauth20';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
    ) { }

    async validateGoogleUser(profile: Profile) {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value?.toLowerCase();

        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { googleId },
                    ...(email ? [{ email }] : []),
                ],
            },
        });

        const { firstname, lastname } = this.extractName(profile);
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

    private extractName(profile: Profile) {
        const given = profile.name?.givenName?.trim() ?? '';
        const family = profile.name?.familyName?.trim() ?? '';
        if (given || family) return { firstname: given || 'Google', lastname: family || 'User' };

        const display = profile.displayName?.trim() ?? 'Google User';
        const parts = display.split(/\s+/);
        const firstname = parts[0] || 'Google';
        const lastname = parts.slice(1).join(' ') || 'User';
        return { firstname, lastname };
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
}
