/** Metodología archivística — 6 pasos del proceso documental (AGN / COOTRANSHUILA). */
export const ARCHIVAL_PROCESS_STEPS = [
  { key: "IDENTIFICATION", label: "Identificación", order: 1 },
  { key: "CLASSIFICATION", label: "Clasificación", order: 2 },
  { key: "ORDERING", label: "Ordenación", order: 3 },
  { key: "FOLIATION", label: "Foliación", order: 4 },
  { key: "LABELING", label: "Rotulación", order: 5 },
  { key: "FUID_INVENTORY", label: "Inventario FUID", order: 6 },
] as const;

export type ArchivalProcessStepKey = (typeof ARCHIVAL_PROCESS_STEPS)[number]["key"];

export type ProcessStepsState = Partial<Record<ArchivalProcessStepKey, boolean>>;

export function defaultProcessSteps(): ProcessStepsState {
  return {
    IDENTIFICATION: false,
    CLASSIFICATION: false,
    ORDERING: false,
    FOLIATION: false,
    LABELING: false,
    FUID_INVENTORY: false,
  };
}

export function parseProcessSteps(raw: unknown): ProcessStepsState {
  const base = defaultProcessSteps();
  if (!raw || typeof raw !== "object") return base;
  for (const step of ARCHIVAL_PROCESS_STEPS) {
    if (step.key in (raw as Record<string, unknown>)) {
      base[step.key] = Boolean((raw as Record<string, unknown>)[step.key]);
    }
  }
  return base;
}

export function processStepsProgress(steps: ProcessStepsState) {
  const total = ARCHIVAL_PROCESS_STEPS.length;
  const done = ARCHIVAL_PROCESS_STEPS.filter((s) => steps[s.key]).length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

export const RETENTION_START_EVENTS = [
  { value: "EXPEDIENTE_CLOSE", label: "Cierre del expediente" },
  { value: "LAST_DOCUMENT", label: "Último documento" },
  { value: "TRAMITE_END", label: "Finalización del trámite" },
  { value: "OTHER", label: "Otro" },
] as const;

export const DOCUMENT_SUPPORTS = [
  { value: "PHYSICAL", label: "Físico" },
  { value: "ELECTRONIC", label: "Electrónico" },
  { value: "HYBRID", label: "Híbrido" },
] as const;

export const ELECTRONIC_FORMATS = ["PDF", "DOCX", "XLSX", "JPG", "TIFF", "PNG"] as const;

export function finalDispositionLabel(d: string | null | undefined) {
  const map: Record<string, string> = {
    CONSERVATION: "Conservación total",
    SELECTION: "Selección",
    ELIMINATION: "Eliminación",
    DIGITALIZATION: "Digitalización",
  };
  return d ? (map[d] ?? d) : "—";
}

/** Pasos guiados de transferencia primaria (8 pasos TRD). */
export const TRANSFER_GUIDED_STEPS = [
  { key: "checklistRetentionMet", label: "Expedientes cumplen retención" },
  { key: "checklistDocumentSelection", label: "Selección documental" },
  { key: "checklistChronological", label: "Orden cronológico" },
  { key: "checklistFoliation", label: "Foliación" },
  { key: "checklistBoxFolder", label: "Carpetas numeradas / cajas organizadas" },
  { key: "checklistInventory", label: "FUID generado" },
  { key: "checklistApproval", label: "Aprobación Archivo Central" },
] as const;
