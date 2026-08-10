import type { ArchivalPhase, DocumentStatus, FinalDisposition } from "@prisma/client";

/** Etapas canónicas del ciclo documental (Ley 594 + workflow). */
export type LifecycleStage =
  | "CREATION"
  | "MANAGEMENT"
  | "CENTRAL"
  | "HISTORICAL"
  | "ELIMINATION"
  | "CONSERVATION";

const WORKFLOW_PENDING: DocumentStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "IN_REVIEW_DEPT",
  "REJECTED_DEPT",
  "APPROVED_DEPT",
  "IN_REVIEW_ARCHIVE",
  "REJECTED_ARCHIVE",
  "PENDING",
  "UNDER_REVIEW",
];

export function isWorkflowPending(status: DocumentStatus) {
  return WORKFLOW_PENDING.includes(status);
}

export function lifecycleStage(doc: {
  status: DocumentStatus;
  archivalPhase?: ArchivalPhase | null;
  appliedFinalDisposition?: FinalDisposition | null;
  deletedAt?: Date | null;
}): LifecycleStage {
  if (doc.deletedAt || doc.status === "DELETED") {
    return doc.appliedFinalDisposition === "CONSERVATION"
      ? "CONSERVATION"
      : "ELIMINATION";
  }
  if (doc.appliedFinalDisposition === "CONSERVATION" && doc.archivalPhase === "HISTORICAL") {
    return "CONSERVATION";
  }
  if (isWorkflowPending(doc.status) && doc.status !== "ARCHIVED") {
    return "CREATION";
  }
  if (doc.status === "HISTORICAL" || doc.archivalPhase === "HISTORICAL") {
    return "HISTORICAL";
  }
  if (doc.status === "TRANSFERRED" || doc.archivalPhase === "CENTRAL") {
    return "CENTRAL";
  }
  if (
    doc.status === "ARCHIVED" ||
    doc.status === "ACTIVE" ||
    doc.archivalPhase === "MANAGEMENT" ||
    !doc.archivalPhase
  ) {
    return "MANAGEMENT";
  }
  return "MANAGEMENT";
}

export function lifecycleStageLabel(stage: LifecycleStage) {
  const map: Record<LifecycleStage, string> = {
    CREATION: "Creación / aprobación",
    MANAGEMENT: "Archivo de Gestión (AG)",
    CENTRAL: "Archivo Central (AC)",
    HISTORICAL: "Archivo Histórico (AH)",
    ELIMINATION: "Eliminación",
    CONSERVATION: "Conservación permanente",
  };
  return map[stage];
}

/** Línea única del ciclo para UI. */
export function lifecyclePathLabel(doc: {
  status: DocumentStatus;
  archivalPhase?: ArchivalPhase | null;
  appliedFinalDisposition?: FinalDisposition | null;
  deletedAt?: Date | null;
}) {
  const stage = lifecycleStage(doc);
  const steps = ["Creación", "AG", "AC", "AH", "Disposición"];
  const idx =
    stage === "CREATION"
      ? 0
      : stage === "MANAGEMENT"
        ? 1
        : stage === "CENTRAL"
          ? 2
          : stage === "HISTORICAL"
            ? 3
            : 4;
  return steps.map((s, i) => (i === idx ? `[${s}]` : s)).join(" → ");
}

export const WORKFLOW_INBOX_STATUSES: DocumentStatus[] = [
  "PENDING_REVIEW",
  "IN_REVIEW_DEPT",
  "APPROVED_DEPT",
  "IN_REVIEW_ARCHIVE",
  "REJECTED_DEPT",
  "REJECTED_ARCHIVE",
];
