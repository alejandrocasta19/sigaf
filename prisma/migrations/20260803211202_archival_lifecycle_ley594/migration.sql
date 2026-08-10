-- CreateEnum
CREATE TYPE "ArchivalPhase" AS ENUM ('MANAGEMENT', 'CENTRAL', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "TransferKind" AS ENUM ('PRIMARY', 'SECONDARY', 'DISPOSAL', 'INTERNAL');

-- AlterTable
ALTER TABLE "documentary_series" ADD COLUMN     "finalDisposition" TEXT NOT NULL DEFAULT 'CONSERVATION',
ADD COLUMN     "retentionCentralYears" INTEGER,
ADD COLUMN     "retentionManagementYears" INTEGER;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "archivalPhase" "ArchivalPhase" NOT NULL DEFAULT 'MANAGEMENT',
ADD COLUMN     "transferredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "expedientes" ADD COLUMN     "archivalPhase" "ArchivalPhase" NOT NULL DEFAULT 'MANAGEMENT',
ADD COLUMN     "transferredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "fromPhase" "ArchivalPhase",
ADD COLUMN     "kind" "TransferKind" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "toPhase" "ArchivalPhase";

-- CreateTable
CREATE TABLE "transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "documentId" TEXT,
    "expedienteId" TEXT,
    "notes" TEXT,

    CONSTRAINT "transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transfer_items_transferId_idx" ON "transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "documents_organizationId_archivalPhase_idx" ON "documents"("organizationId", "archivalPhase");

-- CreateIndex
CREATE INDEX "expedientes_organizationId_archivalPhase_idx" ON "expedientes"("organizationId", "archivalPhase");

-- CreateIndex
CREATE INDEX "transfers_organizationId_kind_idx" ON "transfers"("organizationId", "kind");

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
