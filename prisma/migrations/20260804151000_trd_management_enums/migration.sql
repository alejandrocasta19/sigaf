-- Enums TRD
CREATE TYPE "FinalDisposition" AS ENUM ('CONSERVATION', 'SELECTION', 'ELIMINATION', 'DIGITALIZATION');
CREATE TYPE "DisposalStatus" AS ENUM ('DRAFT', 'INVENTORY_PUBLISHED', 'OBSERVATIONS', 'TECHNICAL_REVIEW', 'ACTA_PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- Instrumentos
ALTER TABLE "archival_instruments" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "archival_instruments" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "archival_instruments" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Series: columnas nuevas (finalDisposition se migra en siguiente migración tras commit del enum)
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "dependencyId" TEXT;
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "instrumentId" TEXT;
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "procedure" TEXT;
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "valueAdministrative" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "valueJuridical" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "valueLegal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "valueFiscal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "valueAccounting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentary_series" ADD COLUMN IF NOT EXISTS "valueHistorical" BOOLEAN NOT NULL DEFAULT false;
