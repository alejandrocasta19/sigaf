import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/shared/kernel/auth";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  documentaryValuesLabel,
  finalDispositionLabel,
} from "@/modules/archival-instruments";
import { StatusBadge } from "@/shared/list/status-labels";

type Props = { params: Promise<{ id: string }> };

export default async function TrdSeriesDetailPage({ params }: Props) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;

  const series = await prisma.documentarySeries.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      dependency: true,
      instrument: true,
      subseries: { orderBy: { code: "asc" } },
      _count: { select: { documents: true } },
    },
  });
  if (!series) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/trd"
          className="mb-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a TRD
        </Link>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">
          Serie {series.code} — {series.name}
        </h1>
        <p className="text-sm text-slate-500">
          {series.dependency
            ? `Dependencia ${series.dependency.code} · ${series.dependency.name}`
            : "Serie institucional"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Retención y disposición (TRD)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field
              label="Archivo de Gestión"
              value={`${series.retentionManagementYears ?? "—"} años`}
            />
            <Field
              label="Archivo Central"
              value={`${series.retentionCentralYears ?? "—"} años`}
            />
            <Field
              label="Retención total"
              value={`${series.retentionYears ?? "—"} años`}
            />
            <div>
              <p className="text-xs text-slate-500">Disposición final</p>
              <StatusBadge
                label={finalDispositionLabel(series.finalDisposition)}
                variant={
                  series.finalDisposition === "ELIMINATION" ? "danger" : "success"
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Field label="Valores documentales" value={documentaryValuesLabel(series)} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Procedimiento" value={series.procedure || "—"} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Descripción" value={series.description || "—"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Instrumento: {series.instrument?.name ?? "TRD institucional"}</p>
            <p>Documentos asociados: {series._count.documents}</p>
            <p>Subseries: {series.subseries.length}</p>
            <Link href="/lifecycle" className="text-blue-600 hover:underline">
              Ver ciclo vital AGN
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subseries</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">AG</th>
                <th className="pb-3 font-medium">AC</th>
                <th className="pb-3 font-medium">Disposición</th>
                <th className="pb-3 font-medium">Valores</th>
              </tr>
            </thead>
            <tbody>
              {series.subseries.map((sub) => (
                <tr key={sub.id} className="border-b border-slate-50">
                  <td className="py-3 font-mono">{sub.code}</td>
                  <td className="py-3">{sub.name}</td>
                  <td className="py-3">
                    {sub.retentionManagementYears ?? series.retentionManagementYears ?? "—"}
                  </td>
                  <td className="py-3">
                    {sub.retentionCentralYears ?? series.retentionCentralYears ?? "—"}
                  </td>
                  <td className="py-3">
                    {finalDispositionLabel(
                      sub.finalDisposition ?? series.finalDisposition
                    )}
                  </td>
                  <td className="py-3 text-xs">{documentaryValuesLabel(sub)}</td>
                </tr>
              ))}
              {series.subseries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Sin subseries definidas
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}
