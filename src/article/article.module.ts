import { Module } from '@nestjs/common';
import { ArticleService } from './article.service';
import { ArticleController } from './article.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ArticleContentService } from './article-content.service';

@Module({
  imports: [PrismaModule],
  controllers: [ArticleController],
  providers: [ArticleService, ArticleContentService],
  exports: [ArticleContentService],
})
export class ArticleModule {}
