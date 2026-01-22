/*
  Warnings:

  - You are about to drop the column `accentColor` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `darkColor` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `lightColor` on the `categories` table. All the data in the column will be lost.
  - Added the required column `colors` to the `categories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "categories" DROP COLUMN "accentColor",
DROP COLUMN "darkColor",
DROP COLUMN "lightColor",
ADD COLUMN     "colors" JSONB NOT NULL;
