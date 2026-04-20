import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { S3Service } from './s3.service';

@Module({
  controllers: [StorageController],
  providers: [S3Service],
  exports: [S3Service],
})
export class StorageModule {}
