-- Add Yandex OAuth provider field
ALTER TABLE "users" ADD COLUMN "yandexId" TEXT;

CREATE UNIQUE INDEX "users_yandexId_key" ON "users"("yandexId");
