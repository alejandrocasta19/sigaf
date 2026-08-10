import { LoanStatus, Prisma } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { documentScope } from "@/modules/documents";
import { AppError } from "@/shared/kernel/http";
import { notifyUser } from "@/shared/kernel/notify";

/** Plazo máximo de préstamo tras aprobación (diagrama). */
export const LOAN_DURATION_MS = 24 * 60 * 60 * 1000;

const GESTORA_ROLES = new Set(["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"]);

export function isLoanGestora(user: SessionUser) {
  return GESTORA_ROLES.has(user.roleCode);
}

export function loanScope(user: SessionUser): Prisma.LoanWhereInput {
  const where: Prisma.LoanWhereInput = { organizationId: user.organizationId };
  if (user.roleCode === "DEPT_HEAD" && user.dependencyId) {
    where.document = { dependencyId: user.dependencyId };
  } else if (user.roleCode === "DEPT_WORKER") {
    where.requesterId = user.id;
  }
  return where;
}

export async function generateLoanCode(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PRE-${year}-`;
  const existing = await prisma.loan.findMany({
    where: { organizationId: orgId, code: { startsWith: prefix } },
    select: { code: true },
  });
  let max = 0;
  for (const row of existing) {
    const m = row.code.match(/^PRE-\d+-(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }
  const entropy = Math.random().toString(16).slice(2, 6);
  return `${prefix}${String(max + 1).padStart(5, "0")}-${entropy}`;
}

async function notifyDocAdmins(
  organizationId: string,
  title: string,
  message: string,
  link = "/loans"
) {
  const admins = await prisma.user.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      deletedAt: null,
      role: { code: { in: ["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"] } },
    },
    select: { id: true },
  });
  for (const admin of admins) {
    await notifyUser({
      organizationId,
      userId: admin.id,
      title,
      message,
      link,
      type: "INFO",
    });
  }
}

export async function listLoans(user: SessionUser, status?: LoanStatus | null) {
  const where: Prisma.LoanWhereInput = { ...loanScope(user) };
  if (status) where.status = status;

  return prisma.loan.findMany({
    where,
    include: {
      document: {
        include: {
          dependency: true,
          versions: {
            orderBy: { version: "desc" },
            take: 5,
            select: { id: true, version: true, filePath: true },
          },
          attachments: {
            take: 10,
            select: { id: true, name: true, filePath: true, mimeType: true },
          },
        },
      },
      requester: true,
      approver: true,
    },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });
}

export async function listAvailableDocumentsForLoan(user: SessionUser, q?: string) {
  return prisma.document.findMany({
    where: {
      ...documentScope(user),
      status: "ACTIVE",
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      loans: {
        none: { status: { in: ["REQUESTED", "ACTIVE", "OVERDUE", "APPROVED"] } },
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      dependency: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
}

export async function requestLoan(
  user: SessionUser,
  data: { documentId: string; notes?: string }
) {
  const doc = await prisma.document.findFirst({
    where: { id: data.documentId, ...documentScope(user), status: "ACTIVE", deletedAt: null },
  });
  if (!doc) throw new AppError("Documento no disponible para préstamo", 404);

  const open = await prisma.loan.findFirst({
    where: {
      documentId: data.documentId,
      status: { in: ["REQUESTED", "ACTIVE", "OVERDUE", "APPROVED"] },
    },
    select: { id: true, code: true, status: true },
  });
  if (open) {
    throw new AppError(
      `Ya existe un préstamo abierto (${open.code}, ${open.status}). Debe devolverlo o esperar resolución.`,
      400
    );
  }

  const code = await generateLoanCode(user.organizationId);
  const loan = await prisma.$transaction(async (tx) => {
    const created = await tx.loan.create({
      data: {
        organizationId: user.organizationId,
        documentId: data.documentId,
        requesterId: user.id,
        code,
        status: "REQUESTED",
        notes: data.notes,
      },
      include: { document: true, requester: true },
    });
    await tx.document.update({
      where: { id: data.documentId },
      data: { status: "PENDING" },
    });
    return created;
  });

  await notifyDocAdmins(
    user.organizationId,
    "Solicitud de préstamo pendiente",
    `${user.fullName} solicitó préstamo de ${loan.document.code} (${loan.code}). Estado: Pendiente de aprobación.`,
    "/approvals"
  );

  return loan;
}

export async function approveLoan(user: SessionUser, id: string) {
  if (!isLoanGestora(user)) {
    throw new AppError("Solo Gestión Documental puede aprobar préstamos", 403);
  }

  const loan = await prisma.loan.findFirst({
    where: { id, organizationId: user.organizationId, status: "REQUESTED" },
    include: { document: true },
  });
  if (!loan) throw new AppError("Préstamo no encontrado o no está pendiente", 404);

  const dueDate = new Date(Date.now() + LOAN_DURATION_MS);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.loan.update({
      where: { id },
      data: {
        status: "ACTIVE",
        approverId: user.id,
        approvedAt: new Date(),
        // Plazo fijo 24h desde la entrega (no configurable por el solicitante)
        dueDate,
      },
      include: { document: true, requester: true, approver: true },
    });
    await tx.document.update({
      where: { id: loan.documentId },
      data: { status: "ON_LOAN" },
    });
    return result;
  });

  await notifyUser({
    organizationId: user.organizationId,
    userId: updated.requesterId,
    title: "Documento entregado — 24 horas",
    message: `Su préstamo ${updated.code} quedó entregado. Debe devolverlo antes de ${dueDate.toLocaleString("es-CO")} (máximo 24 horas).`,
    link: "/loans",
    type: "SUCCESS",
  });

  return updated;
}

export async function rejectLoan(user: SessionUser, id: string) {
  if (!isLoanGestora(user)) {
    throw new AppError("Solo Gestión Documental puede rechazar préstamos", 403);
  }

  const loan = await prisma.loan.findFirst({
    where: { id, organizationId: user.organizationId, status: "REQUESTED" },
  });
  if (!loan) throw new AppError("Préstamo no encontrado o no está pendiente", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.loan.update({
      where: { id },
      data: { status: "REJECTED", approverId: user.id, approvedAt: new Date() },
      include: { document: true, requester: true, approver: true },
    });
    await tx.document.update({
      where: { id: loan.documentId },
      data: { status: "ACTIVE" },
    });
    return result;
  });

  await notifyUser({
    organizationId: user.organizationId,
    userId: updated.requesterId,
    title: "Préstamo rechazado",
    message: `Su solicitud ${updated.code} fue rechazada. El proceso vuelve a estar disponible.`,
    link: "/loans",
    type: "WARNING",
  });

  return updated;
}

export async function returnLoan(user: SessionUser, id: string) {
  const loan = await prisma.loan.findFirst({
    where: {
      id,
      organizationId: user.organizationId,
      status: { in: ["ACTIVE", "APPROVED", "OVERDUE"] },
    },
  });
  if (!loan) throw new AppError("Préstamo no encontrado o no se puede devolver", 404);

  const canReturn = isLoanGestora(user) || loan.requesterId === user.id;
  if (!canReturn) {
    throw new AppError("No tiene permiso para devolver este préstamo", 403);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.loan.update({
      where: { id },
      data: { status: "RETURNED", returnedAt: new Date() },
      include: { document: true, requester: true, approver: true },
    });
    await tx.document.update({
      where: { id: loan.documentId },
      data: { status: "ACTIVE" },
    });
    return updated;
  });
}

/** Marca préstamos ACTIVE vencidos → OVERDUE y notifica al solicitante. */
export async function markOverdueLoans(organizationId: string) {
  const now = new Date();
  const due = await prisma.loan.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      dueDate: { lt: now },
    },
    include: { document: { select: { code: true, name: true } } },
  });

  let marked = 0;
  for (const loan of due) {
    await prisma.loan.update({
      where: { id: loan.id },
      data: { status: "OVERDUE" },
    });
    await notifyUser({
      organizationId,
      userId: loan.requesterId,
      title: "Préstamo vencido",
      message: `El préstamo ${loan.code} del documento ${loan.document.code} venció (plazo 24h). Debe devolverlo y, si necesita continuar, solicitar nuevamente el préstamo.`,
      link: "/loans",
      type: "ALERT",
    });
    marked += 1;
  }

  return { scannedAt: now.toISOString(), marked, codes: due.map((l) => l.code) };
}

export async function listTransfers(user: SessionUser) {
  return prisma.transfer.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
