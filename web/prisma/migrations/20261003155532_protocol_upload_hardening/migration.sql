-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProtocolUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "anonId" TEXT,
    "projectId" TEXT,
    "filename" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "ipHash" TEXT,
    "agreedTermsAt" DATETIME NOT NULL,
    "keepDocument" BOOLEAN NOT NULL,
    "keepConfidential" BOOLEAN NOT NULL DEFAULT false,
    "storedPath" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ProtocolUpload" ("agreedTermsAt", "anonId", "createdAt", "filename", "id", "keepDocument", "mimeType", "projectId", "sizeBytes", "status", "storedPath", "userId") SELECT "agreedTermsAt", "anonId", "createdAt", "filename", "id", "keepDocument", "mimeType", "projectId", "sizeBytes", "status", "storedPath", "userId" FROM "ProtocolUpload";
DROP TABLE "ProtocolUpload";
ALTER TABLE "new_ProtocolUpload" RENAME TO "ProtocolUpload";
CREATE INDEX "ProtocolUpload_anonId_createdAt_idx" ON "ProtocolUpload"("anonId", "createdAt");
CREATE INDEX "ProtocolUpload_userId_createdAt_idx" ON "ProtocolUpload"("userId", "createdAt");
CREATE INDEX "ProtocolUpload_ipHash_createdAt_idx" ON "ProtocolUpload"("ipHash", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
