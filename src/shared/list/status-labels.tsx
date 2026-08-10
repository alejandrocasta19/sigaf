import { DocumentStatus, LoanStatus, TransferStatus, UserStatus } from "@prisma/client";
import { Badge } from "@/shared/ui/badge";

export function documentStatusLabel(status: DocumentStatus) {
  const map: Record<DocumentStatus, string> = {
    DRAFT: "Borrador",
    PENDING_REVIEW: "Pendiente de Revisión",
    IN_REVIEW_DEPT: "En Revisión por el Jefe",
    REJECTED_DEPT: "Rechazado por Dependencia",
    APPROVED_DEPT: "Aprobado por Dependencia",
    IN_REVIEW_ARCHIVE: "En Revisión Archivística",
    REJECTED_ARCHIVE: "Rechazado por Gestión Documental",
    ARCHIVED: "Archivado",
    ACTIVE: "Activo",
    ON_LOAN: "En préstamo",
    PENDING: "Pendiente",
    EXPIRED: "Vencido",
    DELETED: "Eliminado",
    UNDER_REVIEW: "En revisión",
    CLOSED: "Cerrado",
    TRANSFERRED: "Transferido",
    HISTORICAL: "Histórico",
  };
  return map[status] ?? status;
}

export function documentStatusVariant(status: DocumentStatus) {
  if (status === "ARCHIVED" || status === "ACTIVE" || status === "APPROVED_DEPT") {
    return "success" as const;
  }
  if (
    status === "PENDING_REVIEW" ||
    status === "IN_REVIEW_DEPT" ||
    status === "IN_REVIEW_ARCHIVE" ||
    status === "ON_LOAN" ||
    status === "PENDING" ||
    status === "UNDER_REVIEW"
  ) {
    return "warning" as const;
  }
  if (
    status === "REJECTED_DEPT" ||
    status === "REJECTED_ARCHIVE" ||
    status === "DELETED" ||
    status === "EXPIRED"
  ) {
    return "danger" as const;
  }
  if (status === "HISTORICAL" || status === "TRANSFERRED") return "info" as const;
  return "muted" as const;
}

export function loanStatusLabel(status: LoanStatus) {
  const map: Record<LoanStatus, string> = {
    REQUESTED: "Pendiente de aprobación",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    ACTIVE: "Documento entregado",
    RETURNED: "Devuelto",
    OVERDUE: "Vencido",
  };
  return map[status] ?? status;
}

export function loanStatusVariant(status: LoanStatus) {
  if (status === "ACTIVE" || status === "APPROVED") return "success" as const;
  if (status === "REQUESTED") return "warning" as const;
  if (status === "REJECTED" || status === "OVERDUE") return "danger" as const;
  return "muted" as const;
}

export function userStatusLabel(status: UserStatus) {
  const map: Record<UserStatus, string> = {
    ACTIVE: "Activo",
    BLOCKED: "Bloqueado",
    INACTIVE: "Inactivo",
  };
  return map[status] ?? status;
}

export function transferStatusLabel(status: TransferStatus) {
  const map: Record<TransferStatus, string> = {
    DRAFT: "Borrador",
    PENDING: "Pendiente",
    IN_PROGRESS: "En progreso",
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    COMPLETED: "Completada",
  };
  return map[status] ?? status;
}

export function archivalPhaseLabel(phase: string) {
  const map: Record<string, string> = {
    MANAGEMENT: "Archivo de Gestión",
    CENTRAL: "Archivo Central",
    HISTORICAL: "Archivo Histórico",
  };
  return map[phase] ?? phase;
}

export function archivalPhaseVariant(phase: string) {
  if (phase === "MANAGEMENT") return "success" as const;
  if (phase === "CENTRAL") return "warning" as const;
  if (phase === "HISTORICAL") return "info" as const;
  return "muted" as const;
}

export {
  lifecycleStage,
  lifecycleStageLabel,
  lifecyclePathLabel,
  isWorkflowPending,
  WORKFLOW_INBOX_STATUSES,
} from "@/shared/kernel/document-lifecycle";

export function workflowActionLabel(action: string) {
  const map: Record<string, string> = {
    CREATE: "Creación",
    SUBMIT: "Envío a revisión",
    APPROVE_DEPT: "Aprobación dependencia",
    REJECT_DEPT: "Rechazo dependencia",
    APPROVE_ARCHIVE: "Validación archivística",
    REJECT_ARCHIVE: "Rechazo archivístico",
    RESUBMIT: "Reenvío",
    ARCHIVE: "Incorporación al archivo",
    COMMENT: "Comentario / transición",
  };
  return map[action] ?? action;
}

export function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "info" | "muted";
}) {
  return <Badge variant={variant}>{label}</Badge>;
}
