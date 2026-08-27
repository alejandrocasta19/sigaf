import type { RetentionStartEvent } from "@prisma/client";

export type RetentionStartInput = {
  event: RetentionStartEvent;
  /** Fecha indicada por el usuario (TRAMITE_END / OTHER). */
  explicitDate?: Date | null;
  /** Fecha de cierre del expediente (EXPEDIENTE_CLOSE). */
  closedAt?: Date | null;
  /** Fecha del último documento (LAST_DOCUMENT). */
  lastDocumentDate?: Date | null;
};

/**
 * Resuelve la fecha desde la cual corre la retención según el evento TRD.
 * La TRD COOTRANSHUILA exige identificar el hecho o documento que inicia el cómputo.
 */
export function resolveRetentionStartDate(input: RetentionStartInput): Date {
  switch (input.event) {
    case "EXPEDIENTE_CLOSE":
      return input.closedAt ?? input.explicitDate ?? new Date();
    case "LAST_DOCUMENT":
      return input.lastDocumentDate ?? input.explicitDate ?? input.closedAt ?? new Date();
    case "TRAMITE_END":
      return input.explicitDate ?? input.closedAt ?? new Date();
    case "OTHER":
      if (!input.explicitDate) {
        throw new Error("OTHER requiere retentionStartDate explícita");
      }
      return input.explicitDate;
    default:
      return input.explicitDate ?? new Date();
  }
}

/** Fin del periodo en Archivo de Gestión (transferencia primaria). */
export function computeManagementDueAt(startDate: Date, managementYears: number): Date {
  const due = new Date(startDate);
  due.setFullYear(due.getFullYear() + managementYears);
  return due;
}

/** Fin total AG + AC (disposición final). */
export function computeFullRetentionEnd(startDate: Date, agYears: number, acYears: number): Date {
  const due = new Date(startDate);
  due.setFullYear(due.getFullYear() + agYears + acYears);
  return due;
}

export function buildExpedienteRetentionUpdate(params: {
  event: RetentionStartEvent;
  startDate: Date;
  ag: number;
  ac: number;
  disposition: string;
}) {
  return {
    retentionStartEvent: params.event,
    retentionStartDate: params.startDate,
    appliedRetentionMgmt: params.ag,
    appliedRetentionCentral: params.ac,
    appliedFinalDisposition: params.disposition as never,
    retentionDueAt: computeManagementDueAt(params.startDate, params.ag),
  };
}
