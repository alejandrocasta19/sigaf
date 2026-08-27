import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import {
  generateTrdExpedienteCode,
  initialProcessStepsAfterWizard,
  resolveRetentionForExpediente,
} from "./expediente-archival-service";

export function expedienteScope(user: SessionUser): Prisma.ExpedienteWhereInput {
  const where: Prisma.ExpedienteWhereInput = {
    organizationId: user.organizationId,
    deletedAt: null,
  };
  if (
    (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER") &&
    user.dependencyId
  ) {
    where.dependencyId = user.dependencyId;
  }
  return where;
}

export async function generateExpedienteCode(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;
  const last = await prisma.expediente.findFirst({
    where: { organizationId: orgId, code: { startsWith: prefix } },
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

export async function listExpedientes(params: {
  user: SessionUser;
  cursor?: string | null;
  q?: string | null;
  status?: DocumentStatus | null;
  dependencyId?: string | null;
  take?: number;
}) {
  const take = params.take ?? 20;
  const where: Prisma.ExpedienteWhereInput = { ...expedienteScope(params.user) };

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { code: { contains: params.q, mode: "insensitive" } },
      { subject: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.dependencyId) where.dependencyId = params.dependencyId;

  const items = await prisma.expediente.findMany({
    where,
    take: take + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      dependency: true,
      series: true,
      subseries: true,
      responsible: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      _count: { select: { documents: true } },
    },
  });

  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  return {
    items: page,
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    hasMore,
  };
}

export async function createExpediente(
  user: SessionUser,
  data: {
    name: string;
    subject?: string;
    dependencyId: string;
    seriesId?: string;
    subseriesId?: string;
    subsection?: string;
    expedienteType?: string;
    year?: number;
    code?: string;
    description?: string;
    identificationConfirmed?: boolean;
  }
) {
  if (!data.identificationConfirmed) {
    throw new AppError("Debe confirmar el paso de identificación antes de crear el expediente", 400);
  }

  const subject = (data.subject?.trim() || data.name.trim());

  const duplicate = await prisma.expediente.findFirst({
    where: {
      organizationId: user.organizationId,
      dependencyId: data.dependencyId,
      seriesId: data.seriesId ?? null,
      subseriesId: data.subseriesId ?? null,
      deletedAt: null,
      status: { notIn: ["DELETED", "CLOSED"] },
      OR: [
        { subject: { equals: subject, mode: "insensitive" } },
        { name: { equals: subject, mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true },
  });
  if (duplicate) {
    throw new AppError(
      `Ya existe el expediente ${duplicate.code} para este trámite en la misma serie/subserie`,
      409
    );
  }

  const year = data.year ?? new Date().getFullYear();
  const code =
    data.code ??
    (await generateTrdExpedienteCode({
      organizationId: user.organizationId,
      dependencyId: data.dependencyId,
      seriesId: data.seriesId,
      year,
    }));

  const retention = await resolveRetentionForExpediente(data.seriesId, data.subseriesId);

  return prisma.expediente.create({
    data: {
      organizationId: user.organizationId,
      dependencyId: data.dependencyId,
      seriesId: data.seriesId ?? null,
      subseriesId: data.subseriesId ?? null,
      code,
      name: subject,
      subject,
      subsection: data.subsection,
      expedienteType: data.expedienteType ?? "Serie compuesta",
      year,
      description: data.description,
      responsibleId: user.id,
      processSteps: initialProcessStepsAfterWizard({
        identificationConfirmed: data.identificationConfirmed,
      }) as Prisma.InputJsonValue,
      appliedRetentionMgmt: retention.ag,
      appliedRetentionCentral: retention.ac,
      appliedFinalDisposition: retention.disposition,
      retentionStartEvent: "TRAMITE_END",
      retentionStartDate: null,
      retentionDueAt: null,
    },
    include: { dependency: true, series: true, subseries: true },
  });
}

export async function getExpediente(user: SessionUser, id: string) {
  return prisma.expediente.findFirst({
    where: { id, ...expedienteScope(user) },
    include: {
      dependency: true,
      series: true,
      subseries: true,
      organization: { select: { name: true } },
      responsible: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      documents: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { documentDate: "asc" }],
        take: 100,
      },
    },
  });
}

export async function updateExpediente(
  user: SessionUser,
  id: string,
  data: Partial<{ name: string; description: string; status: DocumentStatus; subject: string }>,
  expectedVersion?: number
) {
  const existing = await getExpediente(user, id);
  if (!existing) return null;
  if (expectedVersion != null) {
    const bumped = await prisma.expediente.updateMany({
      where: { id, version: expectedVersion, ...expedienteScope(user) },
      data: { ...data, version: { increment: 1 } },
    });
    if (bumped.count === 0) {
      throw new AppError("El expediente fue modificado por otro usuario. Recargue la página.", 409);
    }
    return getExpediente(user, id);
  }
  return prisma.expediente.update({
    where: { id },
    data: { ...data, version: { increment: 1 } },
    include: { dependency: true, series: true, subseries: true },
  });
}

export async function claimExpedienteVersion(user: SessionUser, id: string, expectedVersion?: number) {
  if (expectedVersion == null) {
    await prisma.expediente.update({
      where: { id },
      data: { version: { increment: 1 } },
    });
    return;
  }
  const bumped = await prisma.expediente.updateMany({
    where: { id, version: expectedVersion, ...expedienteScope(user) },
    data: { version: { increment: 1 } },
  });
  if (bumped.count === 0) {
    throw new AppError("El expediente fue modificado por otro usuario. Recargue la página.", 409);
  }
}

export async function softDeleteExpediente(user: SessionUser, id: string) {
  const exp = await getExpediente(user, id);
  if (!exp) return null;

  await prisma.$transaction([
    prisma.expediente.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DELETED" },
    }),
    prisma.recycleBinItem.create({
      data: {
        entityType: "Expediente",
        entityId: id,
        payload: exp as object,
        deletedBy: user.id,
      },
    }),
  ]);

  return exp;
}

export { generateTrdExpedienteCode, resolveRetentionForExpediente } from "./expediente-archival-service";
