import {
  FinalDisposition,
  Prisma,
  DisposalStatus,
} from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { TRD_GLOSSARY } from "@/shared/kernel/trd-glossary";

export { TRD_GLOSSARY };

export function finalDispositionLabel(d: FinalDisposition | string) {
  const map: Record<string, string> = {
    CONSERVATION: "Conservación total",
    SELECTION: "Selección",
    ELIMINATION: "Eliminación",
    DIGITALIZATION: "Digitalización",
  };
  return map[d] ?? d;
}

export function documentaryValuesLabel(row: {
  valueAdministrative?: boolean;
  valueJuridical?: boolean;
  valueLegal?: boolean;
  valueFiscal?: boolean;
  valueAccounting?: boolean;
  valueHistorical?: boolean;
}) {
  const labels: string[] = [];
  if (row.valueAdministrative) labels.push("Administrativo");
  if (row.valueJuridical) labels.push("Jurídico");
  if (row.valueLegal) labels.push("Legal");
  if (row.valueFiscal) labels.push("Fiscal");
  if (row.valueAccounting) labels.push("Contable");
  if (row.valueHistorical) labels.push("Histórico");
  return labels.length ? labels.join(", ") : "—";
}

export function disposalStatusLabel(s: DisposalStatus) {
  const map: Record<DisposalStatus, string> = {
    DRAFT: "Borrador",
    INVENTORY_PUBLISHED: "Inventario publicado",
    OBSERVATIONS: "Recepción de observaciones",
    TECHNICAL_REVIEW: "Concepto técnico",
    ACTA_PENDING: "Acta de eliminación",
    APPROVED: "Aprobado",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
  };
  return map[s] ?? s;
}

export async function getActiveTrd(user: SessionUser) {
  return prisma.archivalInstrument.findFirst({
    where: {
      organizationId: user.organizationId,
      type: "TRD",
      active: true,
    },
    orderBy: { lastUpdated: "desc" },
  });
}

export async function listTrdTable(user: SessionUser, dependencyId?: string | null) {
  const where: Prisma.DocumentarySeriesWhereInput = {
    organizationId: user.organizationId,
    active: true,
  };
  if (dependencyId) where.dependencyId = dependencyId;

  return prisma.documentarySeries.findMany({
    where,
    include: {
      dependency: true,
      instrument: true,
      subseries: { where: { active: true }, orderBy: { code: "asc" } },
      _count: { select: { documents: true } },
    },
    orderBy: [{ dependency: { code: "asc" } }, { code: "asc" }],
  });
}

export async function listTrdDependencies(user: SessionUser) {
  return prisma.dependency.findMany({
    where: { organizationId: user.organizationId, deletedAt: null, active: true },
    include: {
      _count: { select: { series: true, documents: true, expedientes: true } },
    },
    orderBy: { code: "asc" },
  });
}

export async function getTrdStats(user: SessionUser) {
  const orgId = user.organizationId;
  const [series, subseries, deps, instruments, disposals] = await Promise.all([
    prisma.documentarySeries.count({ where: { organizationId: orgId, active: true } }),
    prisma.documentarySubseries.count({
      where: { series: { organizationId: orgId }, active: true },
    }),
    prisma.dependency.count({
      where: { organizationId: orgId, deletedAt: null, active: true },
    }),
    prisma.archivalInstrument.findMany({
      where: { organizationId: orgId },
      orderBy: { type: "asc" },
    }),
    prisma.disposalProcess.count({
      where: { organizationId: orgId, status: { not: "COMPLETED" } },
    }),
  ]);

  const byDisposition = await prisma.documentarySeries.groupBy({
    by: ["finalDisposition"],
    where: { organizationId: orgId, active: true },
    _count: { _all: true },
  });

  return {
    series,
    subseries,
    deps,
    instruments,
    openDisposals: disposals,
    byDisposition: byDisposition.map((d) => ({
      name: finalDispositionLabel(d.finalDisposition),
      value: d._count._all,
    })),
  };
}

export type TrdIdentificationStatus = {
  trd: {
    active: boolean;
    id: string | null;
    name: string | null;
    version: string | null;
    lastUpdated: string | null;
    seriesCount: number;
  };
  versionAlert: {
    show: boolean;
    message: string | null;
    latestSnapshotVersion: string | null;
    latestSnapshotAt: string | null;
  };
  checks: {
    trd: boolean;
    dependency: boolean;
    series: boolean;
    tramite: boolean;
    unique: boolean;
  };
  details: {
    dependencyName?: string;
    seriesName?: string;
    subseriesName?: string;
    seriesKind?: string;
    duplicateExpedienteCode?: string;
    retentionAg?: number;
    retentionAc?: number;
    disposition?: string;
  };
  messages: string[];
};

/** Validación en línea para paso 1 identificación (TRD vigente + clasificación previa). */
export async function getTrdIdentificationStatus(
  user: SessionUser,
  params?: {
    dependencyId?: string | null;
    seriesId?: string | null;
    subseriesId?: string | null;
    subject?: string | null;
  }
): Promise<TrdIdentificationStatus> {
  const orgId = user.organizationId;
  const [activeTrd, latestSnapshot] = await Promise.all([
    getActiveTrd(user),
    prisma.trdVersion.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const messages: string[] = [];
  const details: TrdIdentificationStatus["details"] = {};
  let dependencyOk = false;
  let seriesOk = false;
  let tramiteOk = false;
  let uniqueOk = true;

  if (!activeTrd) {
    messages.push("No hay TRD activa en el sistema. Contacte al Archivo Central.");
  }

  let versionAlertShow = false;
  let versionAlertMessage: string | null = null;

  if (activeTrd && latestSnapshot) {
    const seriesChangedSinceSnapshot = await prisma.documentarySeries.findFirst({
      where: {
        organizationId: orgId,
        active: true,
        updatedAt: { gt: latestSnapshot.createdAt },
      },
      select: { id: true },
    });
    if (seriesChangedSinceSnapshot) {
      versionAlertShow = true;
      versionAlertMessage = `La TRD fue modificada después del snapshot v${latestSnapshot.version}. Solicite una nueva versión aprobada.`;
    } else if (latestSnapshot.version !== activeTrd.version) {
      versionAlertShow = true;
      versionAlertMessage = `Snapshot TRD v${latestSnapshot.version} difiere de la versión activa v${activeTrd.version}.`;
    }
  }

  if (params?.dependencyId) {
    const dep = await prisma.dependency.findFirst({
      where: {
        id: params.dependencyId,
        organizationId: orgId,
        active: true,
        deletedAt: null,
      },
    });
    if (dep) {
      dependencyOk = true;
      details.dependencyName = dep.name;
    } else {
      messages.push("La dependencia seleccionada no está activa en la TRD.");
    }
  }

  if (params?.seriesId) {
    const series = await prisma.documentarySeries.findFirst({
      where: { id: params.seriesId, organizationId: orgId, active: true },
      include: {
        subseries: { where: { active: true } },
      },
    });
    if (!series) {
      messages.push("La serie no existe o está inactiva en la TRD vigente.");
    } else if (series.dependencyId && params.dependencyId && series.dependencyId !== params.dependencyId) {
      messages.push("La serie no corresponde a la dependencia productora seleccionada.");
    } else {
      seriesOk = true;
      details.seriesName = series.name;
      details.seriesKind = series.seriesKind;
      const sub = params.subseriesId
        ? series.subseries.find((s) => s.id === params.subseriesId)
        : null;
      if (params.subseriesId && !sub) {
        seriesOk = false;
        messages.push("La subserie no está activa en la TRD vigente.");
      } else {
        if (sub) details.subseriesName = sub.name;
        const { resolveTrdRetention } = await import("./trd-crud-service");
        const ret = resolveTrdRetention({
          retentionManagementYears: sub?.retentionManagementYears ?? series.retentionManagementYears,
          retentionCentralYears: sub?.retentionCentralYears ?? series.retentionCentralYears,
          finalDisposition: sub?.finalDisposition ?? series.finalDisposition,
        });
        details.retentionAg = ret.ag;
        details.retentionAc = ret.ac;
        details.disposition = ret.disposition;
      }
    }
  }

  const subject = params?.subject?.trim();
  if (subject && subject.length >= 3) {
    tramiteOk = true;
    if (params?.dependencyId) {
      const dup = await prisma.expediente.findFirst({
        where: {
          organizationId: orgId,
          dependencyId: params.dependencyId,
          seriesId: params.seriesId ?? null,
          subseriesId: params.subseriesId ?? null,
          deletedAt: null,
          status: { notIn: ["DELETED", "CLOSED"] },
          OR: [
            { subject: { equals: subject, mode: "insensitive" } },
            { name: { equals: subject, mode: "insensitive" } },
          ],
        },
        select: { code: true },
      });
      if (dup) {
        uniqueOk = false;
        details.duplicateExpedienteCode = dup.code;
        messages.push(`Ya existe el expediente ${dup.code} para este trámite.`);
      }
    }
  }

  return {
    trd: {
      active: !!activeTrd,
      id: activeTrd?.id ?? null,
      name: activeTrd?.name ?? null,
      version: activeTrd?.version ?? null,
      lastUpdated: activeTrd?.lastUpdated?.toISOString() ?? null,
      seriesCount: activeTrd?.seriesCount ?? 0,
    },
    versionAlert: {
      show: versionAlertShow,
      message: versionAlertMessage,
      latestSnapshotVersion: latestSnapshot?.version ?? null,
      latestSnapshotAt: latestSnapshot?.createdAt?.toISOString() ?? null,
    },
    checks: {
      trd: !!activeTrd,
      dependency: dependencyOk,
      series: seriesOk,
      tramite: tramiteOk,
      unique: uniqueOk,
    },
    details,
    messages,
  };
}

/** Código de expediente TRD: {dep}-{serie}-{año}-{seq} → 20-02-2026-00001 */
export async function generateTrdExpedienteCode(params: {
  organizationId: string;
  dependencyId: string;
  seriesId?: string | null;
}) {
  const dep = await prisma.dependency.findFirst({
    where: { id: params.dependencyId, organizationId: params.organizationId },
  });
  if (!dep) throw new AppError("Dependencia no encontrada", 404);

  let seriesCode = "00";
  if (params.seriesId) {
    const series = await prisma.documentarySeries.findFirst({
      where: { id: params.seriesId, organizationId: params.organizationId },
    });
    if (series) seriesCode = series.code;
  }

  const year = new Date().getFullYear();
  const prefix = `${dep.code}-${seriesCode}-${year}-`;
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

export async function listDisposalProcesses(user: SessionUser) {
  return prisma.disposalProcess.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createDisposalProcess(
  user: SessionUser,
  data: { title: string; inventoryNote?: string; documentIds?: string[] }
) {
  if (!["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode)) {
    throw new AppError("Sin permiso para iniciar eliminación documental", 403);
  }
  const year = new Date().getFullYear();
  const prefix = `ELIM-${year}-`;
  const last = await prisma.disposalProcess.findFirst({
    where: { organizationId: user.organizationId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  let seq = 1;
  if (last?.code) {
    const n = parseInt(last.code.slice(prefix.length), 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return prisma.disposalProcess.create({
    data: {
      organizationId: user.organizationId,
      code: `${prefix}${String(seq).padStart(3, "0")}`,
      title: data.title,
      inventoryNote: data.inventoryNote,
      documentIds: data.documentIds ?? [],
      createdById: user.id,
      status: "DRAFT",
    },
  });
}

export async function advanceDisposalProcess(
  user: SessionUser,
  id: string,
  action: "publish" | "observations" | "technical" | "acta" | "approve" | "complete" | "cancel",
  notes?: string
) {
  if (!["DOC_ADMIN", "SUPER_ADMIN"].includes(user.roleCode)) {
    throw new AppError("Sin permiso", 403);
  }
  const process = await prisma.disposalProcess.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!process) throw new AppError("Proceso no encontrado", 404);

  const transitions: Record<string, { to: DisposalStatus; field?: string }> = {
    publish: { to: "INVENTORY_PUBLISHED" },
    observations: { to: "OBSERVATIONS", field: "observations" },
    technical: { to: "TECHNICAL_REVIEW", field: "technicalConcept" },
    acta: { to: "ACTA_PENDING", field: "actaNote" },
    approve: { to: "APPROVED" },
    complete: { to: "COMPLETED" },
    cancel: { to: "CANCELLED" },
  };
  const next = transitions[action];
  if (!next) throw new AppError("Acción inválida", 400);

  const data: Prisma.DisposalProcessUpdateInput = {
    status: next.to,
    ...(action === "publish" ? { publishedAt: new Date() } : {}),
    ...(action === "complete" ? { completedAt: new Date() } : {}),
  };
  if (next.field && notes) {
    (data as Record<string, unknown>)[next.field] = notes;
  }

  const updated = await prisma.disposalProcess.update({
    where: { id },
    data,
  });

  if (action === "complete" && Array.isArray(process.documentIds)) {
    const ids = process.documentIds as string[];
    if (ids.length) {
      await prisma.document.updateMany({
        where: { id: { in: ids }, organizationId: user.organizationId },
        data: { status: "DELETED", deletedAt: new Date() },
      });
    }
  }

  return updated;
}
