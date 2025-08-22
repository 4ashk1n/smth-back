/*
  Warnings:

  - You are about to drop the column `category` on the `articles` table. All the data in the column will be lost.
  - Added the required column `authorId` to the `articles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mainCategoryId` to the `articles` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."articles" DROP CONSTRAINT "articles_id_fkey";

-- AlterTable
ALTER TABLE "public"."articles" DROP COLUMN "category",
ADD COLUMN     "authorId" TEXT NOT NULL,
ADD COLUMN     "mainCategoryId" TEXT NOT NULL,
ALTER COLUMN "content" SET DATA TYPE JSONB;

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "lightColor" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL,
    "darkColor" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ArticleCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "public"."categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_emoji_key" ON "public"."categories"("emoji");

-- CreateIndex
CREATE INDEX "_ArticleCategories_B_index" ON "public"."_ArticleCategories"("B");

-- AddForeignKey
ALTER TABLE "public"."articles" ADD CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."articles" ADD CONSTRAINT "articles_mainCategoryId_fkey" FOREIGN KEY ("mainCategoryId") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ArticleCategories" ADD CONSTRAINT "_ArticleCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ArticleCategories" ADD CONSTRAINT "_ArticleCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
