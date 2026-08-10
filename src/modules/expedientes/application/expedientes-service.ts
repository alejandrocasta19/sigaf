import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { generateTrdExpedienteCode } from "@/modules/archival-instruments";

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
    ];
  }
  if (params.status) where.status = params.status;
  if (params.dependencyId) where.dependencyId = params.dependencyId;

  const items = await prisma.expediente.findMany({
    where,
    take: take + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { dependency: true, responsible: true, _count: { select: { documents: true } } },
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
    dependencyId: string;
    code?: string;
    description?: string;
    seriesId?: string;
  }
) {
  const code =
    data.code ??
    (await generateTrdExpedienteCode({
      organizationId: user.organizationId,
      dependencyId: data.dependencyId,
      seriesId: data.seriesId,
    }));
  return prisma.expediente.create({
    data: {
      organizationId: user.organizationId,
      dependencyId: data.dependencyId,
      code,
      name: data.name,
      description: data.description,
      responsibleId: user.id,
    },
    include: { dependency: true },
  });
}

export async function getExpediente(user: SessionUser, id: string) {
  return prisma.expediente.findFirst({
    where: { id, ...expedienteScope(user) },
    include: {
      dependency: true,
      responsible: true,
      documents: { where: { deletedAt: null }, take: 50 },
    },
  });
}

export async function updateExpediente(
  user: SessionUser,
  id: string,
  data: Partial<{ name: string; description: string; status: DocumentStatus }>
) {
  const existing = await getExpediente(user, id);
  if (!existing) return null;
  return prisma.expediente.update({
    where: { id },
    data,
    include: { dependency: true },
  });
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
