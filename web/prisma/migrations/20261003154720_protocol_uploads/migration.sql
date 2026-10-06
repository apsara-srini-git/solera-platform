-- CreateTable
CREATE TABLE "ProtocolUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "anonId" TEXT,
    "projectId" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "agreedTermsAt" DATETIME NOT NULL,
    "keepDocument" BOOLEAN NOT NULL,
    "storedPath" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ProtocolUpload_anonId_createdAt_idx" ON "ProtocolUpload"("anonId", "createdAt");

-- CreateIndex
CREATE INDEX "ProtocolUpload_userId_createdAt_idx" ON "ProtocolUpload"("userId", "createdAt");
