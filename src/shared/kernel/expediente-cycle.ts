import {
  ARCHIVAL_PROCESS_STEPS,
  parseProcessSteps,
  type ProcessStepsState,
} from "./archival-process";

export type ExpedienteTransferCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type ExpedienteReadiness = {
  expedienteId: string;
  code: string;
  subject: string;
  ready: boolean;
  checks: ExpedienteTransferCheck[];
  documentCount: number;
};

export function evaluateExpedienteReadiness(exp: {
  id: string;
  code: string;
  subject?: string | null;
  name: string;
  status: string;
  processSteps: unknown;
  foliationVerified: boolean;
  physicalFoliationDone?: boolean;
  foliationBy?: string | null;
  foliationAt?: Date | null;
  chronologicalOrder: boolean;
  folderNumber?: string | null;
  boxCode?: string | null;
  retentionDueAt?: Date | null;
  retentionStartDate?: Date | null;
  closedAt?: Date | null;
  documents?: { id: string }[];
  hasValidatedInventory?: boolean;
}): ExpedienteReadiness {
  const steps = parseProcessSteps(exp.processSteps);
  const docCount = exp.documents?.length ?? 0;
  const now = new Date();

  const checks: ExpedienteTransferCheck[] = [
    {
      key: "documents",
      label: "Tiene documentos vinculados",
      passed: docCount > 0,
      detail: docCount > 0 ? `${docCount} documento(s)` : "Sin documentos",
    },
    {
      key: "process",
      label: "Proceso documental completo (6 pasos)",
      passed: ARCHIVAL_PROCESS_STEPS.every((s) => steps[s.key]),
      detail: `${ARCHIVAL_PROCESS_STEPS.filter((s) => steps[s.key]).length}/6 pasos`,
    },
    {
      key: "ordering",
      label: "Orden cronológico verificado",
      passed: exp.chronologicalOrder || !!steps.ORDERING,
      detail: exp.chronologicalOrder ? "Sí" : "Pendiente",
    },
    {
      key: "foliation",
      label: "Foliación verificada (digital)",
      passed: exp.foliationVerified || !!steps.FOLIATION,
      detail: exp.foliationVerified ? "Sí" : "Pendiente",
    },
    {
      key: "physicalFoliation",
      label: "Foliación física trazada",
      passed: !!(exp.physicalFoliationDone && exp.foliationBy?.trim()),
      detail: exp.physicalFoliationDone
        ? exp.foliationBy?.trim()
          ? `${exp.foliationBy.trim()}${exp.foliationAt ? ` · ${exp.foliationAt.toLocaleDateString("es-CO")}` : ""}`
          : "Falta responsable"
        : "Pendiente",
    },
    {
      key: "labeling",
      label: "Carpeta y caja numeradas",
      passed: !!(exp.folderNumber && exp.boxCode),
      detail: exp.folderNumber && exp.boxCode ? `${exp.folderNumber} / ${exp.boxCode}` : "Pendiente",
    },
    {
      key: "fuid",
      label: "Inventario FUID validado",
      passed: !!steps.FUID_INVENTORY || !!exp.hasValidatedInventory,
      detail: steps.FUID_INVENTORY || exp.hasValidatedInventory ? "Validado" : "Pendiente",
    },
    {
      key: "retention",
      label: "Retención en gestión cumplida",
      passed: !!(exp.retentionDueAt && exp.retentionDueAt <= now),
      detail: exp.retentionDueAt
        ? exp.retentionDueAt <= now
          ? "Cumplida"
          : `Vence ${exp.retentionDueAt.toLocaleDateString("es-CO")}`
        : "Sin fecha de retención",
    },
    {
      key: "closed",
      label: "Expediente cerrado / trámite finalizado",
      passed: exp.status === "CLOSED" || !!exp.closedAt,
      detail: exp.closedAt ? exp.closedAt.toLocaleDateString("es-CO") : "Activo",
    },
  ];

  return {
    expedienteId: exp.id,
    code: exp.code,
    subject: exp.subject ?? exp.name,
    ready: checks.every((c) => c.passed),
    checks,
    documentCount: docCount,
  };
}

export function allProcessStepsComplete(steps: ProcessStepsState) {
  return ARCHIVAL_PROCESS_STEPS.every((s) => steps[s.key]);
}

export function inferElectronicFormat(filename: string): string | undefined {
  const ext = filename.split(".").pop()?.toUpperCase();
  if (!ext) return undefined;
  const allowed = ["PDF", "DOCX", "XLSX", "JPG", "JPEG", "TIFF", "PNG", "DOC", "XLS"];
  if (ext === "JPEG") return "JPG";
  return allowed.includes(ext) ? ext : ext;
}

export function inferSupportFromFile(hasFile: boolean, support?: string): "PHYSICAL" | "ELECTRONIC" | "HYBRID" {
  if (support === "PHYSICAL" || support === "ELECTRONIC" || support === "HYBRID") return support;
  return hasFile ? "ELECTRONIC" : "PHYSICAL";
}
