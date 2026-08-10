import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { listTrdTable, finalDispositionLabel, documentaryValuesLabel } from "@/modules/archival-instruments";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";

export default async function SeriesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const series = await listTrdTable(user);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Series documentales</h1>
          <p className="text-sm text-slate-500">
            Vista de la TRD — retención AG/AC, disposición final y valores
          </p>
        </div>
        <Link
          href="/trd"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Gestión de TRD
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Series ({series.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Dep.</th>
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">AG / AC</th>
                <th className="pb-3 font-medium">Disposición</th>
                <th className="pb-3 font-medium">Valores</th>
                <th className="pb-3 font-medium">Subseries</th>
                <th className="pb-3 font-medium">Docs</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="py-3 font-mono text-xs">{s.dependency?.code ?? "—"}</td>
                  <td className="py-3 font-medium">{s.code}</td>
                  <td className="py-3">
                    <Link href={`/trd/series/${s.id}`} className="text-blue-700 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-600">
                    {s.retentionManagementYears ?? "—"} / {s.retentionCentralYears ?? "—"}
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      label={finalDispositionLabel(s.finalDisposition)}
                      variant={s.finalDisposition === "ELIMINATION" ? "danger" : "success"}
                    />
                  </td>
                  <td className="py-3 text-xs text-slate-600">{documentaryValuesLabel(s)}</td>
                  <td className="py-3 text-slate-600">{s.subseries.length}</td>
                  <td className="py-3 text-slate-600">{s._count.documents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
