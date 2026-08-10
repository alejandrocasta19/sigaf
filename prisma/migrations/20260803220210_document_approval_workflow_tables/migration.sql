-- AlterTable documents (workflow fields)
-- DEFAULT DRAFT ya es seguro: el valor del enum quedó commitado en la migración anterior
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "approvedDeptAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "submittedById" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "workflowNotes" TEXT;
ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managerId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "document_workflow_events" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "WorkflowAction" NOT NULL,
    "fromStatus" "DocumentStatus",
    "toStatus" "DocumentStatus",
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_workflow_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "document_workflow_events_documentId_createdAt_idx" ON "document_workflow_events"("documentId", "createdAt");
CREATE INDEX IF NOT EXISTS "document_workflow_events_actorId_idx" ON "document_workflow_events"("actorId");
CREATE INDEX IF NOT EXISTS "documents_submittedById_idx" ON "documents"("submittedById");
CREATE INDEX IF NOT EXISTS "users_managerId_idx" ON "users"("managerId");

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "document_workflow_events" ADD CONSTRAINT "document_workflow_events_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "document_workflow_events" ADD CONSTRAINT "document_workflow_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
