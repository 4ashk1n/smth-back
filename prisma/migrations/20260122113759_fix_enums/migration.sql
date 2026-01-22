/*
  Warnings:

  - The values [PUBLISHED,ARCHIVED,DRAFT] on the enum `ArticleStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `cover` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `published_at` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `firstname` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastname` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `verificated` on the `users` table. All the data in the column will be lost.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `categories` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'moderator', 'author', 'reader');

-- AlterEnum
BEGIN;
CREATE TYPE "ArticleStatus_new" AS ENUM ('published', 'draft', 'archived', 'review');
ALTER TABLE "articles" ALTER COLUMN "status" TYPE "ArticleStatus_new" USING ("status"::text::"ArticleStatus_new");
ALTER TYPE "ArticleStatus" RENAME TO "ArticleStatus_old";
ALTER TYPE "ArticleStatus_new" RENAME TO "ArticleStatus";
DROP TYPE "public"."ArticleStatus_old";
COMMIT;

-- DropIndex
DROP INDEX "categories_emoji_key";

-- AlterTable
ALTER TABLE "articles" DROP COLUMN "cover",
DROP COLUMN "published_at",
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'draft',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "firstname",
DROP COLUMN "lastname",
DROP COLUMN "verificated",
ALTER COLUMN "avatar" DROP NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'author',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropEnum
DROP TYPE "Role";
