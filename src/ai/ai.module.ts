import { Module } from "@nestjs/common";
import { ArticleModule } from "../article/article.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

@Module({
  imports: [PrismaModule, ArticleModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
