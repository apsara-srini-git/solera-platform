-- Answer memory is now scoped to the recipient's institutional email domain, and only answers the hospital itself
-- provided are stored. Rows stored under the old rules (no domain; unchanged public values) are dropped.
DROP TABLE "SiteAnswer";

CREATE TABLE "SiteAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL,
    "questionEs" TEXT NOT NULL,
    "sourceInvitationId" TEXT NOT NULL,
    "confirmedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "SiteAnswer_siteId_domain_expiresAt_idx" ON "SiteAnswer"("siteId", "domain", "expiresAt");

CREATE UNIQUE INDEX "SiteAnswer_siteId_domain_questionKey_scope_key" ON "SiteAnswer"("siteId", "domain", "questionKey", "scope");
