import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Building2, Landmark, BookOpen, Scale } from "lucide-react";
import { getSession } from "@/shared/kernel/auth";
import {
  ARCHIVAL_PHASES,
  getLifecycleStats,
} from "@/modules/loans-transfers";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";
import { CompleteTransferButton } from "@/modules/loans-transfers/ui/transfer-actions";
import { GlossaryTip } from "@/modules/archival-instruments/ui/glossary-tip";
import type { ArchivalPhase } from "@prisma/client";

const ICONS = {
  MANAGEMENT: Building2,
  CENTRAL: Archive,
  HISTORICAL: Landmark,
};

export default async function LifecyclePage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const stats = await getLifecycleStats(user);
  const canComplete = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"].includes(user.roleCode);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">
          Ciclo vital documental
          <GlossaryTip term="TRD" />
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Conforme a la <strong>Ley 594 de 2000</strong> (Ley General de Archivos), art. 23, y los
          lineamientos del <strong>Archivo General de la Nación (AGN)</strong>: Archivo de Gestión,
          Archivo Central y Archivo Histórico.
        </p>
      </div>

      <Card className="border-slate-200 bg-slate-50/80">
        <CardContent className="flex flex-wrap items-start gap-4 p-5 text-sm text-slate-600">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-slate-800">Marco normativo</p>
            <p>
              Art. 22–24 Ley 594/2000: procesos archivísticos, formación de archivos y tablas de
              retención. Transferencia primaria (Gestión→Central) y secundaria (Central→Histórico)
              según TRD adoptada.
            </p>
            <Link
              href="/help/guide"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              <BookOpen className="h-3.5 w-3.5" /> Ver guía de usuario
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(ARCHIVAL_PHASES) as ArchivalPhase[]).map((key) => {
          const meta = ARCHIVAL_PHASES[key];
          const Icon = ICONS[key];
          return (
            <Card key={key} className={`border ${meta.color.split(" ").find((c) => c.startsWith("border-"))}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-white/80 p-2 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <Badge variant={meta.badge}>{meta.phaseLabel}</Badge>
                      <CardTitle className="mt-1">{meta.name}</CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-slate-600">{meta.description}</p>
                <p className="text-xs text-slate-500">
                  <strong>Responsable:</strong> {meta.responsibility}
                </p>
                <p className="text-[11px] text-slate-400">{meta.lawRef}</p>
                <div className="flex gap-4 border-t border-black/5 pt-3">
                  <div>
                    <p className="page-title text-xl font-bold text-slate-900 sm:text-2xl">{stats.documents[key]}</p>
                    <p className="text-xs text-slate-500">Documentos</p>
                  </div>
                  <div>
                    <p className="page-title text-xl font-bold text-slate-900 sm:text-2xl">{stats.expedientes[key]}</p>
                    <p className="text-xs text-slate-500">Expedientes</p>
                  </div>
                </div>
                <Link
                  href={`/lifecycle/${key.toLowerCase()}`}
                  className="inline-flex text-sm font-medium text-blue-600 hover:underline"
                >
                  Ver inventario de fase →
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transferencias de fase (primaria / secundaria)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-2">Código</th>
                <th className="pb-2">Título</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Fases</th>
                <th className="pb-2">Ítems</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Fecha</th>
                {canComplete && <th className="pb-2">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {stats.recentTransfers.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="py-2.5 font-medium">{t.code}</td>
                  <td className="py-2.5">{t.title}</td>
                  <td className="py-2.5">
                    <Badge variant="muted">{t.kind}</Badge>
                  </td>
                  <td className="py-2.5 text-xs text-slate-600">
                    {t.fromPhase ?? "—"} → {t.toPhase ?? "—"}
                  </td>
                  <td className="py-2.5">{t._count.items}</td>
                  <td className="py-2.5">
                    <Badge variant={t.status === "COMPLETED" ? "success" : "warning"}>
                      {t.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-slate-500">{formatDate(t.createdAt)}</td>
                  {canComplete && (
                    <td className="py-2.5">
                      {t.status !== "COMPLETED" && <CompleteTransferButton id={t.id} />}
                    </td>
                  )}
                </tr>
              ))}
              {stats.recentTransfers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Aún no hay transferencias de ciclo vital
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
