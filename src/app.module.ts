import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticleModule } from './article/article.module';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { NotificationModule } from './notification/notification.module';
import { PrismaModule } from './prisma/prisma.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [PrismaModule, ArticleModule, CategoryModule, UserModule, AuthModule, SearchModule, AiModule, StorageModule, NotificationModule, AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
