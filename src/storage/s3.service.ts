import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

type UploadBufferParams = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
};

type PresignedUploadParams = {
  key: string;
  expiresInSec?: number;
  contentType?: string;
  cacheControl?: string;
};

type PresignedDownloadParams = {
  key: string;
  expiresInSec?: number;
};

@Injectable()
export class S3Service {
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicBaseUrl: string | null;
  private readonly defaultPresignExpiresInSec: number;
  private readonly client: S3Client;

  constructor() {
    const accessKeyId = this.getRequiredEnv('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.getRequiredEnv('S3_SECRET_ACCESS_KEY');
    this.bucket = this.getRequiredEnv('S3_BUCKET');
    this.endpoint = this.getEnv('S3_ENDPOINT', 'https://s3.cloud.ru').replace(/\/+$/, '');
    this.publicBaseUrl = this.getOptionalEnv('S3_PUBLIC_BASE_URL')?.replace(/\/+$/, '') ?? null;
    this.defaultPresignExpiresInSec = this.parsePositiveInt(
      this.getEnv('S3_PRESIGN_EXPIRES_SEC', '900'),
      900,
    );

    this.client = new S3Client({
      region: this.getEnv('S3_REGION', 'ru-central1'),
      endpoint: this.endpoint,
      forcePathStyle: this.parseBool(this.getEnv('S3_FORCE_PATH_STYLE', 'true'), true),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  buildImageObjectKey(fileName: string, folder = 'images') {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitizedFileName}`;
  }

  async uploadBuffer(params: UploadBufferParams) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: params.cacheControl,
      Metadata: params.metadata,
    });

    const result = await this.client.send(command);
    return {
      bucket: this.bucket,
      key: params.key,
      etag: result.ETag ?? null,
      url: this.getObjectUrl(params.key),
    };
  }

  async createPresignedUploadUrl(params: PresignedUploadParams) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
      CacheControl: params.cacheControl,
    });
    const expiresIn = this.parsePositiveInt(params.expiresInSec, this.defaultPresignExpiresInSec);
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { url, key: params.key, expiresIn };
  }

  async createPresignedDownloadUrl(params: PresignedDownloadParams) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
    });
    const expiresIn = this.parsePositiveInt(params.expiresInSec, this.defaultPresignExpiresInSec);
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { url, key: params.key, expiresIn };
  }

  async deleteObject(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    return { deleted: true, key };
  }

  async objectExists(key: string) {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  getObjectUrl(key: string) {
    const encodedKey = key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');

    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${encodedKey}`;
    }

    return `${this.endpoint}/${this.bucket}/${encodedKey}`;
  }

  private parseBool(value: string | undefined, fallback: boolean) {
    if (!value) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
    if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
    return fallback;
  }

  private parsePositiveInt(value: string | number | undefined, fallback: number) {
    if (value === undefined) return fallback;
    const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  }

  private getRequiredEnv(name: string) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} is not set`);
    }
    return value;
  }

  private getOptionalEnv(name: string) {
    const value = process.env[name];
    return value && value.trim() ? value : undefined;
  }

  private getEnv(name: string, fallback: string) {
    return process.env[name] ?? fallback;
  }
}
