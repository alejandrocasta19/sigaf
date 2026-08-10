import { ArchivalPhase, TransferKind, TransferStatus } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";

/** Metadatos del ciclo vital — Ley 594/2000 art. 23 y lineamientos AGN */
export const ARCHIVAL_PHASES = {
  MANAGEMENT: {
    code: "MANAGEMENT" as const,
    name: "Archivo de Gestión",
    phaseLabel: "Fase Activa",
    short: "Gestión",
    description:
      "Documentos en trámite o de consulta frecuente en las oficinas productoras. Valor administrativo, legal o fiscal inmediato.",
    responsibility: "Unidades administrativas productoras",
    lawRef: "Ley 594 de 2000, art. 23 lit. a",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    badge: "success" as const,
  },
  CENTRAL: {
    code: "CENTRAL" as const,
    name: "Archivo Central",
    phaseLabel: "Fase Semiactiva",
    short: "Central",
    description:
      "Documentos transferidos al concluir el trámite principal. Consulta esporádica; se evalúa permanencia o eliminación según TRD.",
    responsibility: "Archivo Central de la entidad",
    lawRef: "Ley 594 de 2000, art. 23 lit. b",
    color: "bg-amber-50 text-amber-900 border-amber-200",
    badge: "warning" as const,
  },
  HISTORICAL: {
    code: "HISTORICAL" as const,
    name: "Archivo Histórico",
    phaseLabel: "Fase Inactiva",
    short: "Histórico",
    description:
      "Conservación permanente por valor cultural, científico o histórico. Patrimonio documental e investigación pública.",
    responsibility: "Archivo Histórico / AGN según competencia",
    lawRef: "Ley 594 de 2000, art. 23 lit. c",
    color: "bg-violet-50 text-violet-900 border-violet-200",
    badge: "info" as const,
  },
} as const;

export function phaseLabel(phase: ArchivalPhase) {
  return ARCHIVAL_PHASES[phase]?.name ?? phase;
}

export function nextPhase(phase: ArchivalPhase): ArchivalPhase | null {
  if (phase === "MANAGEMENT") return "CENTRAL";
  if (phase === "CENTRAL") return "HISTORICAL";
  return null;
}

export function transferKindFor(from: ArchivalPhase, to: ArchivalPhase): TransferKind {
  if (from === "MANAGEMENT" && to === "CENTRAL") return "PRIMARY";
  if (from === "CENTRAL" && to === "HISTORICAL") return "SECONDARY";
  return "INTERNAL";
}

export async function getLifecycleStats(user: SessionUser) {
  const orgId = user.organizationId;
  const depFilter =
    user.roleCode === "DEPT_HEAD" && user.dependencyId
      ? { dependencyId: user.dependencyId }
      : {};

  const phases: ArchivalPhase[] = ["MANAGEMENT", "CENTRAL", "HISTORICAL"];

  const [docCounts, expCounts, transfers] = await Promise.all([
    Promise.all(
      phases.map((archivalPhase) =>
        prisma.document.count({
          where: { organizationId: orgId, deletedAt: null, archivalPhase, ...depFilter },
        })
      )
    ),
    Promise.all(
      phases.map((archivalPhase) =>
        prisma.expediente.count({
          where: { organizationId: orgId, deletedAt: null, archivalPhase, ...depFilter },
        })
      )
    ),
    prisma.transfer.findMany({
      where: {
        organizationId: orgId,
        kind: { in: ["PRIMARY", "SECONDARY", "DISPOSAL"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const documents = Object.fromEntries(
    phases.map((p, i) => [p, docCounts[i]])
  ) as Record<ArchivalPhase, number>;

  const expedientes = Object.fromEntries(
    phases.map((p, i) => [p, expCounts[i]])
  ) as Record<ArchivalPhase, number>;

  return {
    documents,
    expedientes,
    recentTransfers: transfers,
  };
}

export async function listByPhase(
  user: SessionUser,
  phase: ArchivalPhase,
  take = 50
) {
  const orgId = user.organizationId;
  const dep =
    user.roleCode === "DEPT_HEAD" && user.dependencyId
      ? { dependencyId: user.dependencyId }
      : {};

  const [documents, expedientes] = await Promise.all([
    prisma.document.findMany({
      where: { organizationId: orgId, deletedAt: null, archivalPhase: phase, ...dep },
      include: { dependency: true, series: true },
      orderBy: { updatedAt: "desc" },
      take,
    }),
    prisma.expediente.findMany({
      where: { organizationId: orgId, deletedAt: null, archivalPhase: phase, ...dep },
      include: { dependency: true },
      orderBy: { updatedAt: "desc" },
      take,
    }),
  ]);

  return { documents, expedientes, meta: ARCHIVAL_PHASES[phase] };
}

export async function createPhaseTransfer(
  user: SessionUser,
  data: {
    title: string;
    kind: TransferKind;
    fromPhase: ArchivalPhase;
    toPhase: ArchivalPhase;
    documentIds?: string[];
    expedienteIds?: string[];
    notes?: string;
    checklistFoliation?: boolean;
    checklistChronological?: boolean;
    checklistInventory?: boolean;
    checklistBoxFolder?: boolean;
  }
) {
  if (user.roleCode === "CONSULT_USER") {
    throw new Error("Sin permiso para transferencias");
  }

  const checklistOk =
    !!data.checklistFoliation &&
    !!data.checklistChronological &&
    !!data.checklistInventory &&
    !!data.checklistBoxFolder;

  if (!checklistOk) {
    throw new Error(
      "Checklist incompleto: foliación, orden cronológico, inventario y caja/carpeta son obligatorios"
    );
  }

  const docIds = data.documentIds ?? [];
  if (docIds.length) {
    const docs = await prisma.document.findMany({
      where: { id: { in: docIds }, organizationId: user.organizationId },
      include: { folder: { include: { box: true } } },
    });
    for (const d of docs) {
      if (!d.foliationVerified && !data.checklistFoliation) {
        throw new Error(`Documento ${d.code}: foliación no verificada`);
      }
      if (!d.folder?.boxId && !data.checklistBoxFolder) {
        throw new Error(`Documento ${d.code}: sin caja/carpeta asignada`);
      }
    }
  }

  const year = new Date().getFullYear();
  const count = await prisma.transfer.count({
    where: { organizationId: user.organizationId },
  });
  const code = `TRF-${year}-${String(count + 1).padStart(4, "0")}`;

  const items = [
    ...(data.documentIds ?? []).map((documentId) => ({ documentId })),
    ...(data.expedienteIds ?? []).map((expedienteId) => ({ expedienteId })),
  ];

  if (items.length === 0) {
    throw new Error("Seleccione al menos un documento o expediente");
  }

  return prisma.transfer.create({
    data: {
      organizationId: user.organizationId,
      code,
      title: data.title,
      kind: data.kind,
      fromPhase: data.fromPhase,
      toPhase: data.toPhase,
      status: "PENDING",
      notes: data.notes,
      checklistFoliation: true,
      checklistChronological: true,
      checklistInventory: true,
      checklistBoxFolder: true,
      items: { create: items },
    },
    include: { items: true, _count: { select: { items: true } } },
  });
}

export async function completePhaseTransfer(user: SessionUser, transferId: string) {
  if (!["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"].includes(user.roleCode)) {
    throw new Error("Solo archivo/administración puede completar la transferencia");
  }

  const transfer = await prisma.transfer.findFirst({
    where: { id: transferId, organizationId: user.organizationId },
    include: { items: true },
  });
  if (!transfer) throw new Error("Transferencia no encontrada");
  if (transfer.status === "COMPLETED") throw new Error("Ya está completada");
  if (!transfer.toPhase) throw new Error("Transferencia sin fase destino");

  if (
    !transfer.checklistFoliation ||
    !transfer.checklistChronological ||
    !transfer.checklistInventory ||
    !transfer.checklistBoxFolder
  ) {
    throw new Error("No se puede completar: checklist de transferencia incompleto");
  }

  const toPhase = transfer.toPhase;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      if (item.documentId) {
        await tx.document.updateMany({
          where: { id: item.documentId, organizationId: user.organizationId },
          data: {
            archivalPhase: toPhase,
            transferredAt: now,
            status: toPhase === "HISTORICAL" ? "HISTORICAL" : "TRANSFERRED",
          },
        });
      }
      if (item.expedienteId) {
        await tx.expediente.updateMany({
          where: { id: item.expedienteId, organizationId: user.organizationId },
          data: { archivalPhase: toPhase, transferredAt: now },
        });
        await tx.document.updateMany({
          where: {
            expedienteId: item.expedienteId,
            organizationId: user.organizationId,
            deletedAt: null,
          },
          data: {
            archivalPhase: toPhase,
            transferredAt: now,
            status: toPhase === "HISTORICAL" ? "HISTORICAL" : "TRANSFERRED",
          },
        });
      }
    }

    await tx.transfer.update({
      where: { id: transferId },
      data: { status: "COMPLETED" as TransferStatus, completedAt: now },
    });
  });

  return prisma.transfer.findUnique({
    where: { id: transferId },
    include: { items: true, _count: { select: { items: true } } },
  });
}

export async function buildTransferInventory(user: SessionUser, transferId: string) {
  const transfer = await prisma.transfer.findFirst({
    where: { id: transferId, organizationId: user.organizationId },
    include: {
      items: {
        include: {
          // TransferItem doesn't have relations to document - need raw lookup
        },
      },
    },
  });
  if (!transfer) throw new Error("Transferencia no encontrada");

  const docIds = transfer.items.map((i) => i.documentId).filter(Boolean) as string[];
  const expIds = transfer.items.map((i) => i.expedienteId).filter(Boolean) as string[];

  const [documents, expedientes] = await Promise.all([
    prisma.document.findMany({
      where: { id: { in: docIds } },
      include: { dependency: true, series: true, folder: { include: { box: true } } },
    }),
    prisma.expediente.findMany({
      where: { id: { in: expIds } },
      include: { dependency: true },
    }),
  ]);

  return {
    transfer,
    documents,
    expedientes,
    checklist: {
      foliation: transfer.checklistFoliation,
      chronological: transfer.checklistChronological,
      inventory: transfer.checklistInventory,
      boxFolder: transfer.checklistBoxFolder,
    },
  };
}
