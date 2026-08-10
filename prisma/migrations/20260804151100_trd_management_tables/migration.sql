-- Migrar finalDisposition String → enum (valores ya commitados)
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "finalDisposition_new" "FinalDisposition";

UPDATE "documentary_series"
SET "finalDisposition_new" = CASE UPPER(COALESCE("finalDisposition", 'CONSERVATION'))
  WHEN 'CONSERVATION' THEN 'CONSERVATION'::"FinalDisposition"
  WHEN 'SELECTION' THEN 'SELECTION'::"FinalDisposition"
  WHEN 'ELIMINATION' THEN 'ELIMINATION'::"FinalDisposition"
  WHEN 'DIGITALIZATION' THEN 'DIGITALIZATION'::"FinalDisposition"
  ELSE 'CONSERVATION'::"FinalDisposition"
END;

ALTER TABLE "documentary_series" DROP COLUMN IF EXISTS "finalDisposition";
ALTER TABLE "documentary_series" RENAME COLUMN "finalDisposition_new" TO "finalDisposition";
ALTER TABLE "documentary_series" ALTER COLUMN "finalDisposition" SET NOT NULL;
ALTER TABLE "documentary_series" ALTER COLUMN "finalDisposition" SET DEFAULT 'CONSERVATION'::"FinalDisposition";

-- Subseries enriquecidas
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "retentionManagementYears" INTEGER;
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "retentionCentralYears" INTEGER;
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "finalDisposition" "FinalDisposition";
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "valueAdministrative" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "valueJuridical" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "valueLegal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "valueFiscal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "valueAccounting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_subseries" ADD COLUMN IF NOT EXISTS "valueHistorical" BOOLEAN NOT NULL DEFAULT false;

-- Tipos documentales
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'FORMAT';
ALTER TABLE "document_types" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- FKs series
CREATE INDEX IF NOT EXISTS "documentary_series_dependencyId_idx" ON "documentary_series"("dependencyId");
CREATE INDEX IF NOT EXISTS "documentary_series_instrumentId_idx" ON "documentary_series"("instrumentId");

DO $$ BEGIN
  ALTER TABLE "documentary_series" ADD CONSTRAINT "documentary_series_dependencyId_fkey"
    FOREIGN KEY ("dependencyId") REFERENCES "dependencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "documentary_series" ADD CONSTRAINT "documentary_series_instrumentId_fkey"
    FOREIGN KEY ("instrumentId") REFERENCES "archival_instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Procesos de eliminación
CREATE TABLE IF NOT EXISTS "disposal_processes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DisposalStatus" NOT NULL DEFAULT 'DRAFT',
    "inventoryNote" TEXT,
    "observations" TEXT,
    "technicalConcept" TEXT,
    "actaNote" TEXT,
    "documentIds" JSONB,
    "publishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disposal_processes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "disposal_processes_organizationId_code_key" ON "disposal_processes"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "disposal_processes_organizationId_status_idx" ON "disposal_processes"("organizationId", "status");

DO $$ BEGIN
  ALTER TABLE "disposal_processes" ADD CONSTRAINT "disposal_processes_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
