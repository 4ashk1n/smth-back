-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'moderator', 'admin');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user';
