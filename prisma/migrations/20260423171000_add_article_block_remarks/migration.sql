-- CreateTable
CREATE TABLE "article_block_remarks" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_block_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_block_remarks_articleId_blockId_key" ON "article_block_remarks"("articleId", "blockId");

-- CreateIndex
CREATE INDEX "article_block_remarks_articleId_idx" ON "article_block_remarks"("articleId");

-- CreateIndex
CREATE INDEX "article_block_remarks_authorId_idx" ON "article_block_remarks"("authorId");

-- AddForeignKey
ALTER TABLE "article_block_remarks" ADD CONSTRAINT "article_block_remarks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_block_remarks" ADD CONSTRAINT "article_block_remarks_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
