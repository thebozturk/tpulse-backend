-- CreateTable
CREATE TABLE "email_verification_token" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_token_tokenHash_idx" ON "email_verification_token"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verification_token_userId_idx" ON "email_verification_token"("userId");
