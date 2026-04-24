CREATE TABLE "reco_dirty_users" (
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reco_dirty_users_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "reco_dirty_users"
ADD CONSTRAINT "reco_dirty_users_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "reco_dirty_users_updatedAt_idx" ON "reco_dirty_users"("updatedAt");
