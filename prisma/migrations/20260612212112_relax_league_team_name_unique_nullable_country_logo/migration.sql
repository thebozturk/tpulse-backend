-- DropIndex
DROP INDEX "league_name_key";

-- DropIndex
DROP INDEX "team_name_key";

-- AlterTable
ALTER TABLE "league" ALTER COLUMN "countryLogo" DROP NOT NULL;
