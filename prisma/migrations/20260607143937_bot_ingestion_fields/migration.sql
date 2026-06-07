-- Bot ingestion: Post'a kategori + kaynak alanları
ALTER TABLE "post"
  ADD COLUMN "category" SMALLINT,
  ADD COLUMN "sourceId" VARCHAR(64),
  ADD COLUMN "sourceUrl" VARCHAR(500),
  ADD COLUMN "imageUrl" VARCHAR(500);

-- Idempotency: aynı tweet tekrar gelmesin (NULL'lar serbest)
CREATE UNIQUE INDEX "post_sourceId_key" ON "post"("sourceId");
