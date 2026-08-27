-- Optimistic lock + índices de listado / retención
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "expedientes_retentionDueAt_idx" ON "expedientes"("retentionDueAt");

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "fileScanStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "thumbnailKey" TEXT;
CREATE INDEX IF NOT EXISTS "documents_expedienteId_idx" ON "documents"("expedienteId");
CREATE INDEX IF NOT EXISTS "documents_retentionDueAt_idx" ON "documents"("retentionDueAt");
CREATE INDEX IF NOT EXISTS "documents_folderId_idx" ON "documents"("folderId");
CREATE INDEX IF NOT EXISTS "documents_fileScanStatus_idx" ON "documents"("fileScanStatus");

CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "upload_intents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "targetId" TEXT,
    "extra" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_intents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "upload_intents_organizationId_status_createdAt_idx" ON "upload_intents"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "upload_intents_storageKey_idx" ON "upload_intents"("storageKey");

ALTER TABLE "upload_intents" DROP CONSTRAINT IF EXISTS "upload_intents_organizationId_fkey";
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Búsqueda ILIKE / contains sobre searchText
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "documents_searchText_trgm_idx" ON "documents" USING gin ("searchText" gin_trgm_ops);
