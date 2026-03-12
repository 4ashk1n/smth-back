CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "articles_search_fts_idx"
ON "articles"
USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')));

CREATE INDEX "users_search_fts_idx"
ON "users"
USING GIN (to_tsvector('simple', coalesce("username", '') || ' ' || coalesce("firstname", '') || ' ' || coalesce("lastname", '')));

CREATE INDEX "categories_search_fts_idx"
ON "categories"
USING GIN (to_tsvector('simple', coalesce("name", '')));

CREATE INDEX "articles_title_trgm_idx"
ON "articles"
USING GIN (lower("title") gin_trgm_ops);

CREATE INDEX "articles_description_trgm_idx"
ON "articles"
USING GIN (lower(coalesce("description", '')) gin_trgm_ops);

CREATE INDEX "users_username_trgm_idx"
ON "users"
USING GIN (lower("username") gin_trgm_ops);

CREATE INDEX "users_fullname_trgm_idx"
ON "users"
USING GIN (lower(coalesce("firstname", '') || ' ' || coalesce("lastname", '')) gin_trgm_ops);

CREATE INDEX "categories_name_trgm_idx"
ON "categories"
USING GIN (lower("name") gin_trgm_ops);

CREATE INDEX "articles_status_idx"
ON "articles" ("status");

CREATE INDEX "articles_main_category_idx"
ON "articles" ("mainCategoryId");
