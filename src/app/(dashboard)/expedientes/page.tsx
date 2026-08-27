import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { listSeries } from "@/modules/archival-instruments";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";
import {
  documentStatusLabel,
  documentStatusVariant,
  StatusBadge,
} from "@/shared/list/status-labels";
import type { Prisma } from "@prisma/client";
import { ClassificationWizard } from "@/modules/expedientes/ui/classification-wizard";

type Filter = "all" | "no-series" | "retention-overdue" | "retention-soon";

export default async function ExpedientesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const filter = (sp.filter as Filter) || "all";

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

  const now = new Date();
  const dueSoonUntil = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  if (filter === "no-series") {
    where.seriesId = null;
  } else if (filter === "retention-overdue") {
    where.retentionDueAt = { not: null, lte: now };
  } else if (filter === "retention-soon") {
    where.retentionDueAt = { gt: now, lte: dueSoonUntil };
  }

  const canCreate = user.roleCode !== "CONSULT_USER";

  const [expedientes, dependencies, seriesList, org, counts] = await Promise.all([
    prisma.expediente.findMany({
      where,
      include: {
        dependency: true,
        series: true,
        subseries: true,
        responsible: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.dependency.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        ...(user.dependencyId &&
        (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER")
          ? { id: user.dependencyId }
          : {}),
      },
      orderBy: { code: "asc" },
    }),
    listSeries(user),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true },
    }),
    prisma.expediente.groupBy({
      by: ["seriesId"],
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        ...(where.dependencyId ? { dependencyId: where.dependencyId } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const withoutSeriesCount = counts
    .filter((c) => c.seriesId == null)
    .reduce((a, c) => a + c._count._all, 0);

  const filterLabel =
    filter === "no-series"
      ? "Sin serie TRD"
      : filter === "retention-overdue"
        ? "Retención AG vencida"
        : filter === "retention-soon"
          ? "Retención por vencer (90 d)"
          : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Expedientes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Unidad central — TRD → Serie → Expediente → Documentos
        </p>
      </div>

      {canCreate && (
        <ClassificationWizard
          dependencies={dependencies.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
          series={seriesList.map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            dependencyId: s.dependencyId,
            seriesKind: s.seriesKind,
            retentionManagementYears: s.retentionManagementYears,
            retentionCentralYears: s.retentionCentralYears,
            finalDisposition: s.finalDisposition,
            subseries: s.subseries.map((sub) => ({
              id: sub.id,
              code: sub.code,
              name: sub.name,
              retentionManagementYears: sub.retentionManagementYears,
              retentionCentralYears: sub.retentionCentralYears,
              finalDisposition: sub.finalDisposition,
            })),
          }))}
          defaultDependencyId={user.dependencyId}
          organizationName={org?.name}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <FilterChip href="/expedientes" active={filter === "all"} label="Todos" />
        <FilterChip
          href="/expedientes?filter=no-series"
          active={filter === "no-series"}
          label={`Sin serie TRD (${withoutSeriesCount})`}
        />
        <FilterChip
          href="/expedientes?filter=retention-overdue"
          active={filter === "retention-overdue"}
          label="Retención vencida"
        />
        <FilterChip
          href="/expedientes?filter=retention-soon"
          active={filter === "retention-soon"}
          label="Por vencer"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Expedientes ({expedientes.length})
            {filterLabel && (
              <span className="ml-2 text-sm font-normal text-amber-700">· {filterLabel}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Asunto</th>
                <th className="pb-3 font-medium">Serie</th>
                <th className="pb-3 font-medium">Dependencia</th>
                <th className="pb-3 font-medium">Documentos</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Apertura</th>
              </tr>
            </thead>
            <tbody>
              {expedientes.map((e) => (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="py-3">
                    <Link
                      href={`/expedientes/${e.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {e.code}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-800">{e.subject ?? e.name}</td>
                  <td className="py-3">
                    {e.series?.name ? (
                      <span className="text-slate-600">{e.series.name}</span>
                    ) : (
                      <Badge variant="warning">Sin serie TRD</Badge>
                    )}
                  </td>
                  <td className="py-3 text-slate-600">{e.dependency.name}</td>
                  <td className="py-3 text-slate-600">{e._count.documents}</td>
                  <td className="py-3">
                    <StatusBadge
                      label={documentStatusLabel(e.status)}
                      variant={documentStatusVariant(e.status)}
                    />
                  </td>
                  <td className="py-3 text-slate-500">{formatDate(e.openedAt)}</td>
                </tr>
              ))}
              {expedientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No hay expedientes con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
          : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      }
    >
      {label}
    </Link>
  );
}
