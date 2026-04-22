import { Module } from '@nestjs/common';
import { ArticleService } from './article.service';
import { ArticleController } from './article.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ArticleContentService } from './article-content.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ArticleController],
  providers: [ArticleService, ArticleContentService],
  exports: [ArticleContentService],
})
export class ArticleModule {}
