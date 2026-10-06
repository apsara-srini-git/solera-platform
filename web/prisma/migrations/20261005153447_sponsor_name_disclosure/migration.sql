-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "anonId" TEXT,
    "name" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "confidential" TEXT NOT NULL DEFAULT '{}',
    "showSponsorName" BOOLEAN NOT NULL DEFAULT false,
    "sponsorDisplayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("anonId", "confidential", "createdAt", "criteria", "id", "name", "updatedAt", "userId") SELECT "anonId", "confidential", "createdAt", "criteria", "id", "name", "updatedAt", "userId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_anonId_idx" ON "Project"("anonId");
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
