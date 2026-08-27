import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/shared/kernel/prisma";
import { listExpedientesReadiness } from "@/modules/expedientes";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatDate } from "@/shared/kernel/utils";
import { transferStatusLabel, StatusBadge } from "@/shared/list/status-labels";
import { GuidedTransferWizard } from "@/modules/loans-transfers/ui/guided-transfer-wizard";

export default async function TransfersPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const canComplete = ["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode);
  const canTransfer = user.roleCode !== "CONSULT_USER";

  const [transfers, readiness] = await Promise.all([
    prisma.transfer.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    listExpedientesReadiness(user),
  ]);

  const ready = readiness.filter((r) => r.ready);
  const pending = readiness.filter((r) => !r.ready);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Transferencias</h1>
        <p className="text-sm text-slate-500">
          Ciclo: Expediente → FUID → Transferencia primaria →{" "}
          <Link href="/lifecycle" className="text-blue-600 hover:underline">Archivo Central</Link>
        </p>
      </div>

      {canTransfer && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardContent className="py-4">
                <p className="text-xs text-slate-500">Listos para transferencia</p>
                <p className="text-2xl font-bold text-emerald-800">{ready.length}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/30">
              <CardContent className="py-4">
                <p className="text-xs text-slate-500">Pendientes de completar proceso</p>
                <p className="text-2xl font-bold text-amber-800">{pending.length}</p>
              </CardContent>
            </Card>
          </div>
          <GuidedTransferWizard canComplete={canComplete} />
        </>
      )}

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expedientes pendientes ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="pb-2">Código</th>
                  <th className="pb-2">Asunto</th>
                  <th className="pb-2">Requisitos faltantes</th>
                </tr>
              </thead>
              <tbody>
                {pending.slice(0, 20).map((r) => (
                  <tr key={r.expedienteId} className="border-b border-slate-50">
                    <td className="py-2">
                      <Link href={`/expedientes/${r.expedienteId}`} className="font-mono text-blue-700 hover:underline">
                        {r.code}
                      </Link>
                    </td>
                    <td className="py-2">{r.subject}</td>
                    <td className="py-2 text-xs text-amber-800">
                      {r.checks.filter((c) => !c.passed).map((c) => c.label).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de transferencias ({transfers.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Título</th>
                <th className="pb-3 font-medium">Fase</th>
                <th className="pb-3 font-medium">Checklist</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="py-3 font-medium">{t.code}</td>
                  <td className="py-3 text-slate-800">{t.title}</td>
                  <td className="py-3 text-slate-600">{t.fromPhase} → {t.toPhase}</td>
                  <td className="py-3 text-xs text-slate-500">
                    {[
                      t.checklistRetentionMet && "Retención",
                      t.checklistFoliation && "Foliación",
                      t.checklistInventory && "FUID",
                      t.checklistApproval && "Aprobación",
                    ].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="py-3">
                    <StatusBadge label={transferStatusLabel(t.status)} variant={t.status === "COMPLETED" ? "success" : "warning"} />
                  </td>
                  <td className="py-3 text-slate-500">{t.completedAt ? formatDate(t.completedAt) : t.scheduledAt ? formatDate(t.scheduledAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
