-- Document TRD applied fields + transfer readiness
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "foliationVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "chronologicalOrder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "appliedRetentionMgmt" INTEGER;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "appliedRetentionCentral" INTEGER;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "appliedFinalDisposition" "FinalDisposition";
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "retentionDueAt" TIMESTAMP(3);

-- Transfer checklist
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "checklistFoliation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "checklistChronological" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "checklistInventory" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "checklistBoxFolder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "inventoryFilePath" TEXT;

-- Disposal attachments / history
ALTER TABLE "disposal_processes" ADD COLUMN IF NOT EXISTS "inventoryFilePath" TEXT;
ALTER TABLE "disposal_processes" ADD COLUMN IF NOT EXISTS "actaFilePath" TEXT;
ALTER TABLE "disposal_processes" ADD COLUMN IF NOT EXISTS "historyExpedienteId" TEXT;

-- Physical inventories
CREATE TABLE IF NOT EXISTS "physical_inventories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "locationId" TEXT,
    "notes" TEXT,
    "filePath" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "physical_inventories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "physical_inventories_organizationId_code_key" ON "physical_inventories"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "physical_inventories_organizationId_idx" ON "physical_inventories"("organizationId");
DO $$ BEGIN
  ALTER TABLE "physical_inventories" ADD CONSTRAINT "physical_inventories_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TRD versions / snapshots
CREATE TABLE IF NOT EXISTS "trd_versions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "instrumentId" TEXT,
    "version" TEXT NOT NULL,
    "notes" TEXT,
    "snapshot" JSONB NOT NULL,
    "seriesCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trd_versions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "trd_versions_organizationId_createdAt_idx" ON "trd_versions"("organizationId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "trd_versions" ADD CONSTRAINT "trd_versions_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
