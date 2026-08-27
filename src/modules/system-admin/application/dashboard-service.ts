import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { DocumentStatus, Prisma } from "@prisma/client";
import { cacheGetJson, cacheSetJson } from "@/shared/kernel/redis";

export async function getDashboardData(user: SessionUser) {
  const cacheKey = `dash:v2:${user.organizationId}:${user.roleCode}:${user.dependencyId ?? "all"}`;
  const cached = await cacheGetJson<Awaited<ReturnType<typeof loadDashboard>>>(cacheKey);
  if (cached) return cached;
  const data = await loadDashboard(user);
  await cacheSetJson(cacheKey, data, 45);
  return data;
}

async function loadDashboard(user: SessionUser) {
  const orgId = user.organizationId;
  const depFilter =
    (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER") &&
    user.dependencyId
      ? { dependencyId: user.dependencyId }
      : {};

  const docWhere: Prisma.DocumentWhereInput = {
    organizationId: orgId,
    deletedAt: null,
    ...depFilter,
  };

  const expWhere: Prisma.ExpedienteWhereInput = {
    organizationId: orgId,
    deletedAt: null,
    ...depFilter,
  };

  const now = new Date();
  const dueSoonUntil = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [
    totalDocuments,
    totalExpedientes,
    totalBoxes,
    totalFolders,
    activeUsers,
    auditCount,
    activeLoans,
    pendingTransfers,
    docsByDep,
    docsByStatus,
    docsByYear,
    recentAudit,
    notifications,
    recentExpedientes,
    recentDocuments,
    activeLoanList,
    instruments,
    settings,
    lastBackup,
    retentionOverdueCount,
    retentionDueSoonCount,
    withoutSeriesCount,
    retentionOverdueItems,
    retentionDueSoonItems,
  ] = await Promise.all([
    prisma.document.count({ where: docWhere }),
    prisma.expediente.count({ where: expWhere }),
    prisma.box.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.folder.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.user.count({ where: { organizationId: orgId, status: "ACTIVE", deletedAt: null } }),
    prisma.auditLog.count({
      where: { organizationId: orgId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.loan.count({
      where: { organizationId: orgId, status: { in: ["ACTIVE", "APPROVED", "OVERDUE"] } },
    }),
    prisma.transfer.count({
      where: { organizationId: orgId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    prisma.document.groupBy({
      by: ["dependencyId"],
      where: docWhere,
      _count: { _all: true },
    }),
    prisma.document.groupBy({
      by: ["status"],
      where: { organizationId: orgId, deletedAt: null, ...depFilter },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ year: number; count: bigint }[]>`
      SELECT EXTRACT(YEAR FROM COALESCE("documentDate", "createdAt"))::int AS year, COUNT(*)::bigint AS count
      FROM documents
      WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL
      ${user.dependencyId && (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER") ? Prisma.sql`AND "dependencyId" = ${user.dependencyId}` : Prisma.empty}
      GROUP BY 1 ORDER BY 1
    `,
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.notification.findMany({
      where: {
        OR: [{ userId: user.id }, { organizationId: orgId, userId: null }],
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.expediente.findMany({
      where: expWhere,
      include: { dependency: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.document.findMany({
      where: docWhere,
      include: { dependency: true, series: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.loan.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["ACTIVE", "APPROVED", "OVERDUE"] },
        ...(user.roleCode === "DEPT_HEAD" && user.dependencyId
          ? { document: { dependencyId: user.dependencyId } }
          : {}),
      },
      include: {
        document: { select: { id: true, code: true, name: true } },
        requester: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.archivalInstrument.findMany({
      where: { organizationId: orgId },
      orderBy: { type: "asc" },
    }),
    prisma.systemSetting.findMany({
      where: { OR: [{ organizationId: orgId }, { organizationId: null }] },
    }),
    prisma.backupRecord.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expediente.count({
      where: { ...expWhere, retentionDueAt: { not: null, lte: now } },
    }),
    prisma.expediente.count({
      where: {
        ...expWhere,
        retentionDueAt: { gt: now, lte: dueSoonUntil },
      },
    }),
    prisma.expediente.count({
      where: { ...expWhere, seriesId: null },
    }),
    prisma.expediente.findMany({
      where: { ...expWhere, retentionDueAt: { not: null, lte: now } },
      select: {
        id: true,
        code: true,
        name: true,
        subject: true,
        retentionDueAt: true,
        appliedRetentionMgmt: true,
        appliedRetentionCentral: true,
        dependency: { select: { name: true } },
      },
      orderBy: { retentionDueAt: "asc" },
      take: 8,
    }),
    prisma.expediente.findMany({
      where: {
        ...expWhere,
        retentionDueAt: { gt: now, lte: dueSoonUntil },
      },
      select: {
        id: true,
        code: true,
        name: true,
        subject: true,
        retentionDueAt: true,
        appliedRetentionMgmt: true,
        appliedRetentionCentral: true,
        dependency: { select: { name: true } },
      },
      orderBy: { retentionDueAt: "asc" },
      take: 8,
    }),
  ]);

  const deps = await prisma.dependency.findMany({
    where: { organizationId: orgId },
  });
  const depMap = Object.fromEntries(deps.map((d) => [d.id, d.name]));

  const statusLabels: Partial<Record<DocumentStatus, string>> = {
    DRAFT: "Borrador",
    PENDING_REVIEW: "Pendiente de Revisión",
    IN_REVIEW_DEPT: "En Revisión por el Jefe",
    REJECTED_DEPT: "Rechazado por Dependencia",
    APPROVED_DEPT: "Aprobado por Dependencia",
    IN_REVIEW_ARCHIVE: "En Revisión Archivística",
    REJECTED_ARCHIVE: "Rechazado por Gestión Documental",
    ARCHIVED: "Archivado",
    ACTIVE: "Activos",
    ON_LOAN: "En Préstamo",
    PENDING: "Pendientes",
    EXPIRED: "Vencidos",
    DELETED: "Eliminados",
    UNDER_REVIEW: "En Revisión",
    CLOSED: "Cerrados",
    TRANSFERRED: "Transferidos",
    HISTORICAL: "Históricos",
  };

  const locationCount = await prisma.location.count({ where: { organizationId: orgId } });

  return {
    kpis: {
      totalDocuments,
      totalExpedientes,
      totalBoxes,
      totalFolders,
      activeUsers,
      auditCount,
      activeLoans,
      pendingTransfers,
      locationCount,
      retentionOverdue: retentionOverdueCount,
      retentionDueSoon: retentionDueSoonCount,
      withoutSeries: withoutSeriesCount,
    },
    charts: {
      byDependency: docsByDep.map((d) => ({
        name: depMap[d.dependencyId] || "N/D",
        value: d._count._all,
      })),
      byStatus: docsByStatus.map((d) => ({
        name: statusLabels[d.status] || d.status,
        value: d._count._all,
      })),
      byYear: docsByYear.map((d) => ({
        name: String(d.year),
        value: Number(d.count),
      })),
    },
    recentAudit,
    notifications,
    recentExpedientes,
    recentDocuments,
    activeLoanList,
    instruments,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    lastBackup,
    retention: {
      overdue: retentionOverdueItems,
      dueSoon: retentionDueSoonItems,
    },
  };
}
