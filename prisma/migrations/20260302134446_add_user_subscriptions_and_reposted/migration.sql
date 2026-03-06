-- AlterTable
ALTER TABLE "user_article_metrics" ADD COLUMN     "reposted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateIndex
CREATE INDEX "user_subscriptions_followingId_idx" ON "user_subscriptions"("followingId");

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
