-- AlterTable
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "notificationSettings" JSONB;
