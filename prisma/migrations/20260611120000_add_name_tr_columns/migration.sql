-- Türkçe gösterim adları: dil 'tr' ise bu kolonlardan okunur, yoksa İngilizce `name`/`firstName`/`lastName`.
-- Kolonlar nullable; sync INSERT'te varsayılan olarak İngilizce ad ile doldurur, UPDATE'te dokunmaz (admin düzeltmesi korunur).

-- AlterTable
ALTER TABLE "team" ADD COLUMN "nameTr" VARCHAR(50);

-- AlterTable
ALTER TABLE "league" ADD COLUMN "nameTr" VARCHAR(30);

-- AlterTable
ALTER TABLE "player" ADD COLUMN "firstNameTr" VARCHAR(32),
ADD COLUMN "lastNameTr" VARCHAR(32);

-- Backfill: mevcut satırlarda Türkçe alanları İngilizce adla doldur (panelde görünür, admin düzenleyebilir).
UPDATE "team" SET "nameTr" = "name" WHERE "nameTr" IS NULL;
UPDATE "league" SET "nameTr" = "name" WHERE "nameTr" IS NULL;
UPDATE "player" SET "firstNameTr" = "firstName", "lastNameTr" = "lastName" WHERE "firstNameTr" IS NULL;
