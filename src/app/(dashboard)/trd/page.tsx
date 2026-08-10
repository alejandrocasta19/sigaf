import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import {
  getActiveTrd,
  getTrdStats,
  listTrdTable,
  listTrdDependencies,
  finalDispositionLabel,
  documentaryValuesLabel,
  listSeries,
} from "@/modules/archival-instruments";
import { TrdAdminPanel } from "@/modules/archival-instruments/ui/trd-admin-panel";
import { GlossaryTip } from "@/modules/archival-instruments/ui/glossary-tip";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { StatusBadge } from "@/shared/list/status-labels";
import { formatDate } from "@/shared/kernel/utils";
import { BookOpen, Layers, Building2, Trash2, ArrowRight } from "lucide-react";

export default async function TrdPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const canAdmin = ["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode);

  const [stats, table, activeTrd, deps, seriesList] = await Promise.all([
    getTrdStats(user),
    listTrdTable(user),
    getActiveTrd(user),
    listTrdDependencies(user),
    listSeries(user),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Prioridad archivística
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Gestión de las TRD
            <GlossaryTip term="TRD" />
          </h1>
          <p className="text-sm text-slate-500">
            Tablas de Retención Documental — series, subseries, retención AG/AC y
            disposición final
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/trd/disposals"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Trash2 className="h-4 w-4" /> Eliminación documental
          </Link>
          <Link
            href="/help/glossary"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <BookOpen className="h-4 w-4" /> Glosario
          </Link>
        </div>
      </div>

      {activeTrd && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <Badge variant="success">TRD activa</Badge>
              <p className="mt-1 font-semibold text-slate-900">
                {activeTrd.name} · v{activeTrd.version}
              </p>
              <p className="text-xs text-slate-600">
                Actualizada {formatDate(activeTrd.lastUpdated)}
                {activeTrd.approvedAt
                  ? ` · Aprobada ${formatDate(activeTrd.approvedAt)}`
                  : ""}
              </p>
            </div>
            <p className="text-sm text-slate-600">
              {activeTrd.seriesCount} series registradas
            </p>
          </CardContent>
        </Card>
      )}

      {canAdmin && (
        <TrdAdminPanel
          dependencies={deps.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
          series={seriesList.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Dependencias" value={stats.deps} icon={Building2} />
        <Kpi label="Series" value={stats.series} icon={Layers} />
        <Kpi label="Subseries" value={stats.subseries} icon={Layers} />
        <Kpi label="Instrumentos" value={stats.instruments.length} icon={BookOpen} />
        <Kpi label="Eliminaciones abiertas" value={stats.openDisposals} icon={Trash2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {stats.byDisposition.map((d) => (
          <Card key={d.name}>
            <CardContent className="py-4">
              <p className="text-xs text-slate-500">Disposición final</p>
              <p className="font-semibold text-slate-900">{d.name}</p>
              <p className="text-2xl font-bold text-emerald-700">{d.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Ciclo vital AGN", "/lifecycle", "Gestión → Central → Histórico"],
          ["Transferencias", "/transfers", "Primarias y secundarias"],
          ["Archivo físico", "/physical-archive", "Cajas, carpetas y ubicación"],
          ["Dependencias", "/dependencies", "Estructura organizacional"],
        ].map(([label, href, desc]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-300 hover:bg-emerald-50/30"
          >
            <p className="font-medium text-slate-900">{label}</p>
            <p className="mt-1 text-xs text-slate-500">{desc}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
              Abrir <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabla de Retención Documental ({table.length} series)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Dep.</th>
                <th className="pb-3 font-medium">Serie</th>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">AG (años)</th>
                <th className="pb-3 font-medium">AC (años)</th>
                <th className="pb-3 font-medium">Disposición</th>
                <th className="pb-3 font-medium">Valores</th>
                <th className="pb-3 font-medium">Subseries</th>
                <th className="pb-3 font-medium">Docs</th>
              </tr>
            </thead>
            <tbody>
              {table.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 align-top">
                  <td className="py-3 font-mono text-xs">
                    {s.dependency?.code ?? "—"}
                    <div className="font-sans text-[11px] text-slate-500">
                      {s.dependency?.name ?? "Institucional"}
                    </div>
                  </td>
                  <td className="py-3 font-mono font-medium">{s.code}</td>
                  <td className="py-3">
                    <Link
                      href={`/trd/series/${s.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.subseries.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                        {s.subseries.map((sub) => (
                          <li key={sub.id}>
                            {sub.code} — {sub.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-3 text-slate-700">
                    {s.retentionManagementYears ?? "—"}
                  </td>
                  <td className="py-3 text-slate-700">
                    {s.retentionCentralYears ?? "—"}
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      label={finalDispositionLabel(s.finalDisposition)}
                      variant={
                        s.finalDisposition === "ELIMINATION"
                          ? "danger"
                          : s.finalDisposition === "CONSERVATION"
                            ? "success"
                            : "warning"
                      }
                    />
                  </td>
                  <td className="py-3 text-xs text-slate-600">
                    {documentaryValuesLabel(s)}
                  </td>
                  <td className="py-3">{s.subseries.length}</td>
                  <td className="py-3">{s._count.documents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Layers;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
