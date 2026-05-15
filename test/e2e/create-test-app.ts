import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { AiService } from '../../src/ai/ai.service';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { S3Service } from '../../src/storage/s3.service';

type TestAppContext = {
  app: INestApplication;
  prisma: PrismaService;
  authService: AuthService;
};

export async function createTestApp(): Promise<TestAppContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(S3Service)
    .useValue({
      buildImageObjectKey: (fileName: string, folder = 'images') => `${folder}/e2e-${fileName}`,
      createPresignedUploadUrl: async ({ key, expiresInSec }: { key: string; expiresInSec?: number }) => ({
        key,
        url: `https://example.test/upload/${encodeURIComponent(key)}`,
        expiresIn: expiresInSec ?? 900,
      }),
      createPresignedDownloadUrl: async ({ key, expiresInSec }: { key: string; expiresInSec?: number }) => ({
        key,
        url: `https://example.test/download/${encodeURIComponent(key)}`,
        expiresIn: expiresInSec ?? 900,
      }),
      deleteObject: async (key: string) => ({ deleted: true, key }),
      objectExists: async () => true,
      getObjectUrl: (key: string) => `https://example.test/object/${encodeURIComponent(key)}`,
    })
    .overrideProvider(AiService)
    .useValue({
      getSuggestions: async () => ({ success: true, data: [] }),
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    authService: app.get(AuthService),
  };
}
