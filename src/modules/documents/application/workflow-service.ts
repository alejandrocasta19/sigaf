import { DocumentStatus, DocumentSupport, Prisma, WorkflowAction } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { createNotification } from "@/modules/notifications";
import { inferElectronicFormat, inferSupportFromFile } from "@/shared/kernel/expediente-cycle";
import {
  buildSearchText,
  documentScope,
  generateDocumentCode,
  generateQrCode,
} from "./documents-service";

export const DEPT_REVIEW_STATUSES: DocumentStatus[] = [
  "PENDING_REVIEW",
  "IN_REVIEW_DEPT",
  "REJECTED_ARCHIVE",
];

export const ARCHIVE_REVIEW_STATUSES: DocumentStatus[] = [
  "APPROVED_DEPT",
  "IN_REVIEW_ARCHIVE",
];

function assertRole(user: SessionUser, roles: SessionUser["roleCode"][]) {
  if (!roles.includes(user.roleCode) && user.roleCode !== "SUPER_ADMIN") {
    throw new AppError("Sin permiso para esta acción del flujo", 403);
  }
}

async function logEvent(params: {
  documentId: string;
  actorId: string;
  action: WorkflowAction;
  fromStatus?: DocumentStatus | null;
  toStatus?: DocumentStatus | null;
  observations?: string | null;
}) {
  return prisma.documentWorkflowEvent.create({
    data: {
      documentId: params.documentId,
      actorId: params.actorId,
      action: params.action,
      fromStatus: params.fromStatus ?? undefined,
      toStatus: params.toStatus ?? undefined,
      observations: params.observations ?? undefined,
    },
  });
}

async function notifyUser(params: {
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  link: string;
  type?: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
}) {
  await createNotification({
    organizationId: params.organizationId,
    userId: params.userId,
    title: params.title,
    message: params.message,
    link: params.link,
    type: params.type ?? "INFO",
  });
}

async function findDeptHeads(organizationId: string, dependencyId: string) {
  return prisma.user.findMany({
    where: {
      organizationId,
      dependencyId,
      deletedAt: null,
      status: "ACTIVE",
      role: { code: "DEPT_HEAD" },
    },
    select: { id: true },
  });
}

async function findDocAdmins(organizationId: string) {
  return prisma.user.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: "ACTIVE",
      role: { code: { in: ["DOC_ADMIN", "SUPER_ADMIN"] } },
    },
    select: { id: true },
  });
}

/** Carga documento por funcionario → Pendiente de Revisión */
export async function submitDocumentForReview(
  user: SessionUser,
  data: {
    name: string;
    description?: string;
    dependencyId: string;
    expedienteId?: string;
    documentTypeId?: string;
    seriesId?: string;
    subseriesId?: string;
    folioCount?: number;
    observations?: string;
    responsibleId?: string;
    documentDate?: string;
    support?: DocumentSupport;
    electronicFormat?: string;
    fileName?: string;
  }
) {
  assertRole(user, ["DEPT_WORKER", "DEPT_HEAD", "DOC_ADMIN"]);

  if (
    (user.roleCode === "DEPT_WORKER" || user.roleCode === "DEPT_HEAD") &&
    user.dependencyId &&
    data.dependencyId !== user.dependencyId
  ) {
    throw new AppError("Solo puede cargar documentos de su dependencia", 403);
  }

  let seriesId = data.seriesId;
  let subseriesId = data.subseriesId;
  let expedienteId = data.expedienteId;

  if (data.expedienteId) {
    const exp = await prisma.expediente.findFirst({
      where: {
        id: data.expedienteId,
        organizationId: user.organizationId,
        deletedAt: null,
      },
    });
    if (!exp) throw new AppError("Expediente no encontrado", 404);
    if (exp.status === "CLOSED") throw new AppError("El expediente está cerrado", 400);
    if (exp.dependencyId !== data.dependencyId) {
      throw new AppError("El expediente no pertenece a la dependencia indicada", 400);
    }
    seriesId = exp.seriesId ?? seriesId;
    subseriesId = exp.subseriesId ?? subseriesId;
    expedienteId = exp.id;
  }

  const support = inferSupportFromFile(!!data.fileName, data.support);
  const electronicFormat =
    data.electronicFormat ?? (data.fileName ? inferElectronicFormat(data.fileName) : undefined);

  const code = await generateDocumentCode(user.organizationId, {
    dependencyId: data.dependencyId,
    seriesId,
  });
  let qrCode = generateQrCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.document.findUnique({ where: { qrCode } });
    if (!exists) break;
    qrCode = generateQrCode();
  }

  const status: DocumentStatus = "PENDING_REVIEW";
  const now = new Date();
  const docDate = data.documentDate ? new Date(data.documentDate) : now;

  let sortOrder = 0;
  if (expedienteId) {
    const max = await prisma.document.aggregate({
      where: { expedienteId, deletedAt: null },
      _max: { sortOrder: true },
    });
    sortOrder = (max._max.sortOrder ?? 0) + 1;
  }

  const doc = await prisma.document.create({
    data: {
      organizationId: user.organizationId,
      dependencyId: data.dependencyId,
      expedienteId,
      documentTypeId: data.documentTypeId,
      seriesId,
      subseriesId,
      code,
      qrCode,
      name: data.name,
      description: data.description,
      folioCount: data.folioCount ?? 1,
      observations: data.observations,
      documentDate: docDate,
      support,
      electronicFormat,
      sortOrder,
      status,
      submittedById: user.id,
      responsibleId: data.responsibleId ?? user.id,
      submittedAt: now,
      searchText: buildSearchText({
        name: data.name,
        code,
        observations: data.observations,
      }),
    },
    include: { dependency: true, expediente: true },
  });

  await logEvent({
    documentId: doc.id,
    actorId: user.id,
    action: "SUBMIT",
    fromStatus: null,
    toStatus: status,
    observations: "Documento cargado para revisión de dependencia",
  });

  const heads = await findDeptHeads(user.organizationId, data.dependencyId);
  await Promise.all(
    heads.map((h) =>
      notifyUser({
        organizationId: user.organizationId,
        userId: h.id,
        title: "Documento pendiente de revisión",
        message: `${doc.code} · ${doc.name} — cargado por ${user.fullName}`,
        link: `/documents/${doc.id}`,
        type: "WARNING",
      })
    )
  );

  try {
    const { applyTrdCalculationToDocument } = await import(
      "@/modules/archival-instruments/application/trd-crud-service"
    );
    await applyTrdCalculationToDocument(user, doc.id);
  } catch {
    /* sin serie TRD aún */
  }

  if (expedienteId) {
    const { applyRetentionFromEvent } = await import(
      "@/modules/expedientes/application/expediente-cycle-service"
    );
    const exp = await prisma.expediente.findUnique({
      where: { id: expedienteId },
      select: { retentionStartEvent: true, retentionStartDate: true },
    });
    if (exp?.retentionStartEvent === "LAST_DOCUMENT" || !exp?.retentionStartDate) {
      await applyRetentionFromEvent(expedienteId, "LAST_DOCUMENT", docDate);
    }
  }

  return doc;
}

/** Jefe: toma en revisión */
export async function startDeptReview(user: SessionUser, documentId: string) {
  assertRole(user, ["DEPT_HEAD"]);
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...documentScope(user) },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);
  if (!DEPT_REVIEW_STATUSES.includes(doc.status) && doc.status !== "REJECTED_ARCHIVE") {
    throw new AppError("El documento no está pendiente de revisión de dependencia", 400);
  }

  const toStatus: DocumentStatus = "IN_REVIEW_DEPT";
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { status: toStatus },
  });
  await logEvent({
    documentId: doc.id,
    actorId: user.id,
    action: "COMMENT",
    fromStatus: doc.status,
    toStatus,
    observations: "En revisión por el Jefe de Dependencia",
  });
  return updated;
}

/** Jefe: aprueba → Aprobado por Dependencia / En Revisión Archivística */
export async function approveByDept(
  user: SessionUser,
  documentId: string,
  observations?: string
) {
  assertRole(user, ["DEPT_HEAD"]);
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...documentScope(user) },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);
  if (
    !["PENDING_REVIEW", "IN_REVIEW_DEPT", "REJECTED_ARCHIVE"].includes(doc.status)
  ) {
    throw new AppError("Estado inválido para aprobación de dependencia", 400);
  }

  const toStatus: DocumentStatus = "APPROVED_DEPT";
  const now = new Date();
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      status: toStatus,
      approvedDeptAt: now,
      workflowNotes: observations ?? null,
    },
  });

  await logEvent({
    documentId: doc.id,
    actorId: user.id,
    action: "APPROVE_DEPT",
    fromStatus: doc.status,
    toStatus,
    observations: observations ?? "Aprobado por Jefe de Dependencia",
  });

  // Pasa automáticamente a bandeja de Gestión Documental
  await prisma.document.update({
    where: { id: doc.id },
    data: { status: "IN_REVIEW_ARCHIVE" },
  });
  await logEvent({
    documentId: doc.id,
    actorId: user.id,
    action: "COMMENT",
    fromStatus: toStatus,
    toStatus: "IN_REVIEW_ARCHIVE",
    observations: "Enviado a revisión archivística",
  });

  const admins = await findDocAdmins(user.organizationId);
  await Promise.all(
    admins.map((a) =>
      notifyUser({
        organizationId: user.organizationId,
        userId: a.id,
        title: "Revisión archivística pendiente",
        message: `${doc.code} · ${doc.name} — aprobado por dependencia`,
        link: `/documents/${doc.id}`,
        type: "INFO",
      })
    )
  );

  if (doc.submittedById) {
    await notifyUser({
      organizationId: user.organizationId,
      userId: doc.submittedById,
      title: "Documento aprobado por dependencia",
      message: `${doc.code} pasó a revisión archivística`,
      link: `/documents/${doc.id}`,
      type: "SUCCESS",
    });
  }

  return prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
}

/** Jefe: rechaza → Rechazado por Dependencia */
export async function rejectByDept(
  user: SessionUser,
  documentId: string,
  observations: string
) {
  assertRole(user, ["DEPT_HEAD"]);
  if (!observations?.trim()) {
    throw new AppError("Debe indicar observaciones para el rechazo", 400);
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...documentScope(user) },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);
  if (
    !["PENDING_REVIEW", "IN_REVIEW_DEPT", "REJECTED_ARCHIVE"].includes(doc.status)
  ) {
    throw new AppError("Estado inválido para rechazo de dependencia", 400);
  }

  const toStatus: DocumentStatus = "REJECTED_DEPT";
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { status: toStatus, workflowNotes: observations },
  });

  await logEvent({
    documentId: doc.id,
    actorId: user.id,
    action: "REJECT_DEPT",
    fromStatus: doc.status,
    toStatus,
    observations,
  });

  if (doc.submittedById) {
    await notifyUser({
      organizationId: user.organizationId,
      userId: doc.submittedById,
      title: "Documento rechazado por dependencia",
      message: `${doc.code}: ${observations}`,
      link: `/documents/${doc.id}`,
      type: "ERROR",
    });
  }

  return updated;
}

/** Funcionario: reenvía tras corrección */
export async function resubmitDocument(
  user: SessionUser,
  documentId: string,
  observations?: string
) {
  assertRole(user, ["DEPT_WORKER", "DEPT_HEAD"]);
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...documentScope(user) },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);
  if (doc.status !== "REJECTED_DEPT") {
    throw new AppError("Solo se pueden reenviar documentos rechazados por dependencia", 400);
  }
  if (
    user.roleCode === "DEPT_WORKER" &&
    doc.submittedById &&
    doc.submittedById !== user.id
  ) {
    throw new AppError("Solo el funcionario que cargó el documento puede reenviarlo", 403);
  }

  const toStatus: DocumentStatus = "PENDING_REVIEW";
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      status: toStatus,
      submittedAt: new Date(),
      workflowNotes: observations ?? null,
    },
  });

  await logEvent({
    documentId: doc.id,
    actorId: user.id,
    action: "RESUBMIT",
    fromStatus: doc.status,
    toStatus,
    observations: observations ?? "Documento corregido y reenviado",
  });

  const heads = await findDeptHeads(user.organizationId, doc.dependencyId);
  await Promise.all(
    heads.map((h) =>
      notifyUser({
        organizationId: user.organizationId,
        userId: h.id,
        title: "Documento reenviado para revisión",
        message: `${doc.code} · ${doc.name}`,
        link: `/documents/${doc.id}`,
        type: "WARNING",
      })
    )
  );

  return updated;
}

/** Gestión Documental: valida e incorpora al archivo */
export async function approveByArchive(
  user: SessionUser,
  documentId: string,
  observations?: string
) {
  assertRole(user, ["DOC_ADMIN"]);
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId: user.organizationId, deletedAt: null },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);
  if (!["APPROVED_DEPT", "IN_REVIEW_ARCHIVE"].includes(doc.status)) {
    throw new AppError("El documento no está en revisión archivística", 400);
  }

  const toStatus: DocumentStatus = "ARCHIVED";
  const now = new Date();

  // Asegurar código/QR definitivos (solo si aún es borrador temporal)
  let code = doc.code;
  let qrCode = doc.qrCode;
  if (!code || code.startsWith("TMP-") || code.startsWith("BOR-")) {
    code = await generateDocumentCode(user.organizationId, {
      dependencyId: doc.dependencyId,
      seriesId: doc.seriesId ?? undefined,
    });
  }
  if (!qrCode) {
    qrCode = generateQrCode();
  }

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      status: toStatus,
      code,
      qrCode,
      archivedAt: now,
      workflowNotes: observations ?? null,
      archivalPhase: "MANAGEMENT",
      searchText: buildSearchText({
        name: doc.name,
        code,
        observations: doc.observations,
      }),
    },
  });

  await logEvent({
    documentId: doc.id,
    actorId: user.id,
    action: "APPROVE_ARCHIVE",
    fromStatus: doc.status,
    toStatus,
    observations:
      observations ??
      "Validación archivística OK · Incorporado al Sistema de Gestión Documental",
  });
  await logEvent({
    documentId: doc.id,
    actorId: user.id,
    action: "ARCHIVE",
    fromStatus: toStatus,
    toStatus,
    observations: `Código ${code} · QR ${qrCode}`,
  });

  const notifyIds = new Set<string>();
  if (doc.submittedById) notifyIds.add(doc.submittedById);
  const heads = await findDeptHeads(user.organizationId, doc.dependencyId);
  heads.forEach((h) => notifyIds.add(h.id));

  await Promise.all(
    [...notifyIds].map((uid) =>
      notifyUser({
        organizationId: user.organizationId,
        userId: uid,
        title: "Documento archivado",
        message: `${code} · ${doc.name} incorporado al archivo institucional`,
        link: `/documents/${doc.id}`,
        type: "SUCCESS",
      })
    )
  );

  return updated;
}

/** Gestión Documental: rechaza → vuelve al Jefe */
export async function rejectByArchive(
  user: SessionUser,
  documentId: string,
  observations: string
) {
  assertRole(user, ["DOC_ADMIN"]);
  if (!observations?.trim()) {
    throw new AppError("Debe indicar observaciones archivísticas", 400);
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId: user.organizationId, deletedAt: null },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);
  if (!["APPROVED_DEPT", "IN_REVIEW_ARCHIVE"].includes(doc.status)) {
    throw new AppError("El documento no está en revisión archivística", 400);
  }

  const toStatus: DocumentStatus = "REJECTED_ARCHIVE";
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { status: toStatus, workflowNotes: observations },
  });

  await logEvent({
    documentId: doc.id,
    actorId: user.id,
    action: "REJECT_ARCHIVE",
    fromStatus: doc.status,
    toStatus,
    observations,
  });

  const heads = await findDeptHeads(user.organizationId, doc.dependencyId);
  await Promise.all(
    heads.map((h) =>
      notifyUser({
        organizationId: user.organizationId,
        userId: h.id,
        title: "Documento rechazado por Gestión Documental",
        message: `${doc.code}: ${observations}`,
        link: `/documents/${doc.id}`,
        type: "ERROR",
      })
    )
  );

  return updated;
}

const inboxInclude = {
  dependency: true,
  submittedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  documentType: true,
  series: true,
  versions: {
    orderBy: { version: "desc" as const },
    take: 5,
    select: { id: true, version: true, filePath: true },
  },
  attachments: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    select: { id: true, name: true, filePath: true, mimeType: true },
  },
};

export async function listWorkflowInbox(user: SessionUser) {
  if (user.roleCode === "DEPT_HEAD" && user.dependencyId) {
    return prisma.document.findMany({
      where: {
        organizationId: user.organizationId,
        dependencyId: user.dependencyId,
        deletedAt: null,
        status: { in: ["PENDING_REVIEW", "IN_REVIEW_DEPT", "REJECTED_ARCHIVE"] },
      },
      include: inboxInclude,
      orderBy: { submittedAt: "asc" },
      take: 100,
    });
  }

  if (user.roleCode === "DOC_ADMIN" || user.roleCode === "SUPER_ADMIN") {
    return prisma.document.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        status: { in: ["APPROVED_DEPT", "IN_REVIEW_ARCHIVE"] },
      },
      include: inboxInclude,
      orderBy: { approvedDeptAt: "asc" },
      take: 100,
    });
  }

  if (user.roleCode === "DEPT_WORKER") {
    return prisma.document.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        OR: [
          { submittedById: user.id },
          ...(user.dependencyId ? [{ dependencyId: user.dependencyId }] : []),
        ],
        status: {
          in: [
            "DRAFT",
            "PENDING_REVIEW",
            "IN_REVIEW_DEPT",
            "REJECTED_DEPT",
            "APPROVED_DEPT",
            "IN_REVIEW_ARCHIVE",
            "REJECTED_ARCHIVE",
          ],
        },
      },
      include: inboxInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  return [];
}

export async function getWorkflowHistory(user: SessionUser, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...documentScope(user) },
    select: { id: true },
  });
  if (!doc) return null;

  return prisma.documentWorkflowEvent.findMany({
    where: { documentId },
    include: {
      actor: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listTeamMembers(user: SessionUser) {
  if (user.roleCode !== "DEPT_HEAD" || !user.dependencyId) {
    throw new AppError("Solo el Jefe de Dependencia puede ver su equipo", 403);
  }

  return prisma.user.findMany({
    where: {
      organizationId: user.organizationId,
      dependencyId: user.dependencyId,
      deletedAt: null,
      OR: [{ managerId: user.id }, { role: { code: "DEPT_WORKER" } }],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      status: true,
      roleId: true,
      dependencyId: true,
      organizationId: true,
      mfaEnabled: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      role: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export function workflowActionLabel(action: WorkflowAction) {
  const map: Record<WorkflowAction, string> = {
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

export type WorkflowInboxItem = Prisma.DocumentGetPayload<{
  include: {
    dependency: true;
    submittedBy: {
      select: { id: true; firstName: true; lastName: true; email: true };
    };
    documentType: true;
    series: true;
    versions: {
      select: { id: true; version: true; filePath: true };
    };
    attachments: {
      select: { id: true; name: true; filePath: true; mimeType: true };
    };
  };
}>;
