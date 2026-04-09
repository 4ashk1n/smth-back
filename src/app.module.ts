import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ArticleModule } from './article/article.module';
import { CategoryModule } from './category/category.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { SearchModule } from './search/search.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [PrismaModule, ArticleModule, CategoryModule, UserModule, AuthModule, SearchModule, AiModule, StorageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
