-- CreateTable
CREATE TABLE "waitlist_subscribers" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "source" VARCHAR(60),
    "status" VARCHAR(20) NOT NULL DEFAULT 'subscribed',
    "launchEmailSentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launch_campaigns" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "ctaLabel" VARCHAR(80),
    "ctaUrl" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Queued',
    "total" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "launch_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_subscribers_email_key" ON "waitlist_subscribers"("email");

-- CreateIndex
CREATE INDEX "waitlist_subscribers_status_launchEmailSentAt_idx" ON "waitlist_subscribers"("status", "launchEmailSentAt");

-- CreateIndex
CREATE INDEX "launch_campaigns_createdAt_idx" ON "launch_campaigns"("createdAt");
