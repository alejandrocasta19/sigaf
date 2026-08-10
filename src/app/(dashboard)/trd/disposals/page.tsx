import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import {
  disposalStatusLabel,
  listDisposalProcesses,
} from "@/modules/archival-instruments";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";
import { formatDate } from "@/shared/kernel/utils";
import { DisposalActions } from "@/modules/archival-instruments/ui/disposal-actions";
import {
  DisposalCandidatesPanel,
  PublishInventoryButton,
} from "@/modules/archival-instruments/ui/disposal-candidates-panel";

export default async function DisposalsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const processes = await listDisposalProcesses(user);
  const canManage = ["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(
    user.roleCode
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/trd" className="text-sm text-blue-600 hover:underline">
          ← Gestión TRD
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Eliminación documental
        </h1>
        <p className="text-sm text-slate-500">
          Flujo legal: inventario → observaciones → concepto técnico → acta →
          conservación del historial
        </p>
      </div>

      {canManage && (
        <>
          <DisposalCandidatesPanel />
          <DisposalActions />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Procesos ({processes.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Título</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Creado</th>
                <th className="pb-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 align-top">
                  <td className="py-3 font-medium">{p.code}</td>
                  <td className="py-3">
                    <p>{p.title}</p>
                    {p.inventoryNote && (
                      <p className="text-xs text-slate-500">{p.inventoryNote}</p>
                    )}
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      label={disposalStatusLabel(p.status)}
                      variant={
                        p.status === "COMPLETED"
                          ? "success"
                          : p.status === "CANCELLED"
                            ? "muted"
                            : "warning"
                      }
                    />
                  </td>
                  <td className="py-3 text-slate-500">{formatDate(p.createdAt)}</td>
                  <td className="py-3">
                    <div className="space-y-2">
                      {canManage && p.status !== "COMPLETED" && p.status !== "CANCELLED" && (
                        <>
                          <PublishInventoryButton processId={p.id} />
                          <DisposalActions processId={p.id} status={p.status} compact />
                        </>
                      )}
                      {p.inventoryFilePath && (
                        <p className="text-[10px] text-slate-500">Inventario: {p.inventoryFilePath}</p>
                      )}
                      {p.actaFilePath && (
                        <p className="text-[10px] text-slate-500">Acta: {p.actaFilePath}</p>
                      )}
                      {p.historyExpedienteId && (
                        <p className="text-[10px] text-emerald-700">
                          Historial: {p.historyExpedienteId}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {processes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No hay procesos de eliminación registrados.
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
