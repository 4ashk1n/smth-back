import { BadRequestException, Body, Controller, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { z } from 'zod';
import {
  ConfirmImageUploadRequestSchema,
  type ConfirmImageUploadRequest,
  type ConfirmImageUploadResponse,
  PrepareImageUploadRequestSchema,
  type PrepareImageUploadRequest,
  type PrepareImageUploadResponse,
} from '@smth/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { S3Service } from './s3.service';

type ZodSchemaLike = { parse: (value: unknown) => unknown };
const asZodType = <T extends ZodSchemaLike>(schema: T) => schema as unknown as z.ZodType;

@Controller('uploads/images')
@UseGuards(AuthGuard('jwt'))
export class StorageController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload-url')
  async createUploadUrl(
    @Body(new ZodValidationPipe(asZodType(PrepareImageUploadRequestSchema))) dto: PrepareImageUploadRequest,
  ): Promise<PrepareImageUploadResponse> {
    if (dto.contentType && !dto.contentType.startsWith('image/')) {
      throw new BadRequestException('Only image content types are allowed');
    }

    const key = this.s3Service.buildImageObjectKey(dto.filename, 'images');
    const presigned = await this.s3Service.createPresignedUploadUrl({
      key,
      contentType: dto.contentType,
    });

    return {
      success: true as const,
      data: {
        key: presigned.key,
        uploadUrl: presigned.url,
        expiresIn: presigned.expiresIn,
      },
    };
  }

  @Post('confirm')
  async confirmUpload(
    @Body(new ZodValidationPipe(asZodType(ConfirmImageUploadRequestSchema))) dto: ConfirmImageUploadRequest,
  ): Promise<ConfirmImageUploadResponse> {
    const exists = await this.s3Service.objectExists(dto.key);
    if (!exists) {
      throw new NotFoundException('Uploaded image not found in storage');
    }

    return {
      success: true as const,
      data: {
        key: dto.key,
        url: this.s3Service.getObjectUrl(dto.key),
      },
    };
  }
}
