import { FinalDisposition, FoliationMethod, Prisma, RetentionStartEvent } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import {
  ARCHIVAL_PROCESS_STEPS,
  parseProcessSteps,
  type ArchivalProcessStepKey,
  type ProcessStepsState,
} from "@/shared/kernel/archival-process";
import { resolveTrdRetention } from "@/modules/archival-instruments/application/trd-crud-service";
import {
  buildExpedienteRetentionUpdate,
  computeManagementDueAt,
  resolveRetentionStartDate,
} from "@/shared/kernel/retention-policy";
import { expedienteScope, getExpediente } from "./expedientes-service";

export async function generateTrdExpedienteCode(params: {
  organizationId: string;
  dependencyId: string;
  seriesId?: string | null;
  year?: number;
}) {
  const year = params.year ?? new Date().getFullYear();
  const dep = await prisma.dependency.findUnique({
    where: { id: params.dependencyId },
    select: { code: true },
  });
  let seriesCode = "000";
  if (params.seriesId) {
    const s = await prisma.documentarySeries.findUnique({
      where: { id: params.seriesId },
      select: { code: true },
    });
    seriesCode = s?.code ?? "000";
  }
  const prefix = `${dep?.code ?? "00"}-${seriesCode}-${year}-`;
  const last = await prisma.expediente.findFirst({
    where: { organizationId: params.organizationId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let seq = 1;
  if (last?.code) {
    const num = parseInt(last.code.slice(prefix.length), 10);
    if (!Number.isNaN(num)) seq = num + 1;
  }
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

export async function computeExpedienteRetention(params: {
  seriesId?: string | null;
  subseriesId?: string | null;
  startDate: Date;
  retentionMgmtYears: number;
}) {
  return computeManagementDueAt(params.startDate, params.retentionMgmtYears);
}

export async function applyExpedienteRetentionPolicy(
  expedienteId: string,
  event: RetentionStartEvent,
  context: {
    explicitDate?: Date | null;
    closedAt?: Date | null;
  } = {}
) {
  const exp = await prisma.expediente.findUnique({
    where: { id: expedienteId },
    select: { seriesId: true, subseriesId: true, retentionStartDate: true },
  });
  if (!exp) return null;

  let lastDocumentDate: Date | null = null;
  if (event === "LAST_DOCUMENT") {
    const last = await prisma.document.findFirst({
      where: { expedienteId, deletedAt: null, documentDate: { not: null } },
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
      select: { documentDate: true },
    });
    lastDocumentDate = last?.documentDate ?? null;
  }

  const explicitDate =
    event === "TRAMITE_END" || event === "OTHER"
      ? (context.explicitDate ?? exp.retentionStartDate)
      : context.explicitDate;

  const startDate = resolveRetentionStartDate({
    event,
    explicitDate,
    closedAt: context.closedAt ?? null,
    lastDocumentDate,
  });

  const retention = await resolveRetentionForExpediente(exp.seriesId, exp.subseriesId);

  return prisma.expediente.update({
    where: { id: expedienteId },
    data: buildExpedienteRetentionUpdate({
      event,
      startDate,
      ag: retention.ag,
      ac: retention.ac,
      disposition: retention.disposition,
    }),
  });
}

export async function resolveRetentionForExpediente(
  seriesId?: string | null,
  subseriesId?: string | null
): Promise<{ ag: number; ac: number; disposition: FinalDisposition }> {
  if (subseriesId) {
    const sub = await prisma.documentarySubseries.findUnique({
      where: { id: subseriesId },
      include: { series: true },
    });
    if (sub) {
      return resolveTrdRetention({
        retentionManagementYears: sub.retentionManagementYears,
        retentionCentralYears: sub.retentionCentralYears,
        finalDisposition: sub.finalDisposition,
        seriesFallback: {
          retentionManagementYears: sub.series.retentionManagementYears,
          retentionCentralYears: sub.series.retentionCentralYears,
          finalDisposition: sub.series.finalDisposition,
        },
      });
    }
  }
  if (seriesId) {
    const s = await prisma.documentarySeries.findUnique({ where: { id: seriesId } });
    if (s) {
      return resolveTrdRetention({
        retentionManagementYears: s.retentionManagementYears,
        retentionCentralYears: s.retentionCentralYears,
        finalDisposition: s.finalDisposition,
      });
    }
  }
  return { ag: 2, ac: 8, disposition: "CONSERVATION" as FinalDisposition };
}

export async function getExpedienteArchivalDetail(user: SessionUser, id: string) {
  const exp = await prisma.expediente.findFirst({
    where: { id, ...expedienteScope(user) },
    include: {
      organization: { select: { name: true } },
      dependency: true,
      series: true,
      subseries: true,
      documents: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { documentDate: "asc" }, { createdAt: "asc" }],
        include: { documentType: true },
      },
    },
  });
  if (!exp) return null;
  return {
    ...exp,
    processSteps: parseProcessSteps(exp.processSteps),
  };
}

export async function updateExpedienteProcessStep(
  user: SessionUser,
  id: string,
  step: ArchivalProcessStepKey,
  done: boolean
) {
  const exp = await getExpediente(user, id);
  if (!exp) throw new AppError("Expediente no encontrado", 404);

  const steps = parseProcessSteps(exp.processSteps);
  steps[step] = done;

  return prisma.expediente.update({
    where: { id },
    data: { processSteps: steps as Prisma.InputJsonValue },
  });
}

export async function updateExpedienteFoliation(
  user: SessionUser,
  id: string,
  data: {
    assignments: { documentId: string; folioStart: number; folioCount: number }[];
    chronologicalOrder: boolean;
    foliationVerified: boolean;
    physicalFoliationDone?: boolean;
    foliationMethod?: FoliationMethod;
    foliationBy?: string;
    foliationAt?: string;
  }
) {
  const exp = await getExpediente(user, id);
  if (!exp) throw new AppError("Expediente no encontrado", 404);

  let folioEnd = 0;
  await prisma.$transaction(
    data.assignments.map((a, idx) => {
      folioEnd = Math.max(folioEnd, a.folioStart + a.folioCount - 1);
      return prisma.document.update({
        where: { id: a.documentId },
        data: {
          folioCount: a.folioCount,
          sortOrder: idx + 1,
          foliationVerified: data.foliationVerified,
          chronologicalOrder: data.chronologicalOrder,
        },
      });
    })
  );

  const steps = parseProcessSteps(exp.processSteps);
  if (data.foliationVerified && data.physicalFoliationDone) steps.FOLIATION = true;
  if (data.chronologicalOrder) steps.ORDERING = true;

  return prisma.expediente.update({
    where: { id },
    data: {
      foliationVerified: data.foliationVerified,
      physicalFoliationDone: data.physicalFoliationDone ?? exp.physicalFoliationDone,
      foliationMethod: data.foliationMethod,
      foliationBy: data.foliationBy?.trim() || undefined,
      foliationAt: data.foliationAt ? new Date(data.foliationAt) : undefined,
      chronologicalOrder: data.chronologicalOrder,
      folioStart: data.assignments[0]?.folioStart ?? null,
      folioEnd: folioEnd || null,
      processSteps: steps as Prisma.InputJsonValue,
    },
  });
}

export async function reorderExpedienteDocuments(
  user: SessionUser,
  id: string,
  documentIds: string[]
) {
  const exp = await getExpediente(user, id);
  if (!exp) throw new AppError("Expediente no encontrado", 404);

  await prisma.$transaction(
    documentIds.map((docId, idx) =>
      prisma.document.update({
        where: { id: docId, expedienteId: id },
        data: { sortOrder: idx + 1 },
      })
    )
  );

  const steps = parseProcessSteps(exp.processSteps);
  steps.ORDERING = true;

  return prisma.expediente.update({
    where: { id },
    data: {
      chronologicalOrder: true,
      processSteps: steps as Prisma.InputJsonValue,
    },
  });
}

export async function setExpedienteRetention(
  user: SessionUser,
  id: string,
  data: {
    retentionStartEvent: RetentionStartEvent;
    retentionStartDate: string;
  }
) {
  const exp = await getExpedienteArchivalDetail(user, id);
  if (!exp) throw new AppError("Expediente no encontrado", 404);

  const startDate = resolveRetentionStartDate({
    event: data.retentionStartEvent,
    explicitDate: new Date(data.retentionStartDate),
  });
  const retention = await resolveRetentionForExpediente(exp.seriesId, exp.subseriesId);

  return prisma.expediente.update({
    where: { id },
    data: buildExpedienteRetentionUpdate({
      event: data.retentionStartEvent,
      startDate,
      ag: retention.ag,
      ac: retention.ac,
      disposition: retention.disposition,
    }),
  });
}

export async function updateExpedientePhysicalLabels(
  user: SessionUser,
  id: string,
  data: { folderNumber?: string; boxCode?: string; dateStart?: string; dateEnd?: string }
) {
  const exp = await getExpediente(user, id);
  if (!exp) throw new AppError("Expediente no encontrado", 404);

  const steps = parseProcessSteps(exp.processSteps);
  if (data.folderNumber || data.boxCode) steps.LABELING = true;

  return prisma.expediente.update({
    where: { id },
    data: {
      folderNumber: data.folderNumber,
      boxCode: data.boxCode,
      dateStart: data.dateStart ? new Date(data.dateStart) : undefined,
      dateEnd: data.dateEnd ? new Date(data.dateEnd) : undefined,
      processSteps: steps as Prisma.InputJsonValue,
    },
  });
}

export function buildHierarchyTree(exp: {
  organization?: { name: string } | null;
  dependency: { code: string; name: string };
  subsection?: string | null;
  series?: { code: string; name: string } | null;
  subseries?: { code: string; name: string } | null;
  code: string;
  name: string;
  documents?: { name: string; code: string }[];
}) {
  const lines: { level: number; label: string }[] = [
    { level: 0, label: exp.organization?.name ?? "Fondo" },
    { level: 1, label: `${exp.dependency.name} (Sección ${exp.dependency.code})` },
  ];
  if (exp.subsection) lines.push({ level: 2, label: `Subsección: ${exp.subsection}` });
  if (exp.series) lines.push({ level: 3, label: `Serie: ${exp.series.name}` });
  if (exp.subseries) lines.push({ level: 4, label: `Subserie: ${exp.subseries.name}` });
  lines.push({ level: 5, label: `Expediente: ${exp.code}` });
  for (const d of exp.documents ?? []) {
    lines.push({ level: 6, label: d.name || d.code });
  }
  return lines;
}

export function initialProcessStepsAfterWizard(opts?: { identificationConfirmed?: boolean }): ProcessStepsState {
  return {
    IDENTIFICATION: opts?.identificationConfirmed ?? false,
    CLASSIFICATION: true,
    ORDERING: false,
    FOLIATION: false,
    LABELING: false,
    FUID_INVENTORY: false,
  };
}

export { ARCHIVAL_PROCESS_STEPS };
