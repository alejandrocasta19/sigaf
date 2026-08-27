-- Archival workflow: expediente TRD classification, process steps, FUID inventories

CREATE TYPE "ArchivalProcessStepKey" AS ENUM ('IDENTIFICATION', 'CLASSIFICATION', 'ORDERING', 'FOLIATION', 'LABELING', 'FUID_INVENTORY');
CREATE TYPE "RetentionStartEvent" AS ENUM ('EXPEDIENTE_CLOSE', 'LAST_DOCUMENT', 'TRAMITE_END', 'OTHER');
CREATE TYPE "DocumentSupport" AS ENUM ('PHYSICAL', 'ELECTRONIC', 'HYBRID');
CREATE TYPE "InventoryStatus" AS ENUM ('DRAFT', 'IN_PREPARATION', 'VALIDATED', 'SENT');

ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "seriesId" TEXT;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "subseriesId" TEXT;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "subsection" TEXT;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "expedienteType" TEXT NOT NULL DEFAULT 'Serie compuesta';
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "year" INTEGER;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "processSteps" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "retentionStartEvent" "RetentionStartEvent";
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "retentionStartDate" TIMESTAMP(3);
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "appliedRetentionMgmt" INTEGER;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "appliedRetentionCentral" INTEGER;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "appliedFinalDisposition" "FinalDisposition";
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "retentionDueAt" TIMESTAMP(3);
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "foliationVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "chronologicalOrder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "folderNumber" TEXT;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "boxCode" TEXT;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "folioStart" INTEGER;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "folioEnd" INTEGER;
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "dateStart" TIMESTAMP(3);
ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "dateEnd" TIMESTAMP(3);

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "support" "DocumentSupport" NOT NULL DEFAULT 'PHYSICAL';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "electronicFormat" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "checklistRetentionMet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "checklistApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "document_inventories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "transferCode" TEXT,
    "status" "InventoryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_inventories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "document_inventory_items" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "expedienteId" TEXT,
    "documentId" TEXT,
    "seriesName" TEXT,
    "expedienteCode" TEXT,
    "boxCode" TEXT,
    "folderNumber" TEXT,
    "folioCount" INTEGER,
    "notes" TEXT,
    CONSTRAINT "document_inventory_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_inventories_organizationId_code_key" ON "document_inventories"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "document_inventories_organizationId_status_idx" ON "document_inventories"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "document_inventory_items_inventoryId_idx" ON "document_inventory_items"("inventoryId");
CREATE INDEX IF NOT EXISTS "expedientes_seriesId_idx" ON "expedientes"("seriesId");
CREATE INDEX IF NOT EXISTS "expedientes_subseriesId_idx" ON "expedientes"("subseriesId");

ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "documentary_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_subseriesId_fkey" FOREIGN KEY ("subseriesId") REFERENCES "documentary_subseries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_inventories" ADD CONSTRAINT "document_inventories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_inventories" ADD CONSTRAINT "document_inventories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_inventory_items" ADD CONSTRAINT "document_inventory_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "document_inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
