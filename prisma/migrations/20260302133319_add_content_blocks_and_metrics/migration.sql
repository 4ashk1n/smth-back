-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "layout" JSONB,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks_paragraph" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "blocks_paragraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks_image" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT,
    "sourceUrl" TEXT,
    "label" TEXT,

    CONSTRAINT "blocks_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks_icon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "blocks_icon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_article_metrics" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "focusTime" INTEGER NOT NULL,
    "viewedPages" INTEGER NOT NULL,
    "liked" BOOLEAN NOT NULL,
    "saved" BOOLEAN NOT NULL,
    "disliked" BOOLEAN NOT NULL,
    "subscribed" BOOLEAN NOT NULL,
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "user_article_metrics_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateTable
CREATE TABLE "user_feed" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_feed_userId_articleId_idx" ON "user_feed"("userId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_feed_userId_position_key" ON "user_feed"("userId", "position");

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks_paragraph" ADD CONSTRAINT "blocks_paragraph_id_fkey" FOREIGN KEY ("id") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks_image" ADD CONSTRAINT "blocks_image_id_fkey" FOREIGN KEY ("id") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks_icon" ADD CONSTRAINT "blocks_icon_id_fkey" FOREIGN KEY ("id") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_article_metrics" ADD CONSTRAINT "user_article_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_article_metrics" ADD CONSTRAINT "user_article_metrics_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feed" ADD CONSTRAINT "user_feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feed" ADD CONSTRAINT "user_feed_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
