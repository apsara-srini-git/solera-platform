-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "consentAt" DATETIME;

-- CreateTable
CREATE TABLE "SiteAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL,
    "questionEs" TEXT NOT NULL,
    "sourceInvitationId" TEXT NOT NULL,
    "confirmedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LibraryQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "es" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "uses" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SiteAnswer_siteId_expiresAt_idx" ON "SiteAnswer"("siteId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteAnswer_siteId_questionKey_scope_key" ON "SiteAnswer"("siteId", "questionKey", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryQuestion_key_key" ON "LibraryQuestion"("key");
