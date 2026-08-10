import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatDate } from "@/shared/kernel/utils";
import { transferStatusLabel, StatusBadge } from "@/shared/list/status-labels";

export default async function TransfersPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const transfers = await prisma.transfer.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transferencias</h1>
        <p className="text-sm text-slate-500">
          Transferencias entre dependencias y de ciclo vital (primaria/secundaria). Gestiona fases en{" "}
          <Link href="/lifecycle" className="text-blue-600 hover:underline">
            Ciclo vital AGN
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transferencias ({transfers.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Título</th>
                <th className="pb-3 font-medium">Origen</th>
                <th className="pb-3 font-medium">Destino</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Programada</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="py-3 font-medium">{t.code}</td>
                  <td className="py-3 text-slate-800">{t.title}</td>
                  <td className="py-3 text-slate-600">{t.fromDependency ?? "—"}</td>
                  <td className="py-3 text-slate-600">{t.toDependency ?? "—"}</td>
                  <td className="py-3">
                    <StatusBadge
                      label={transferStatusLabel(t.status)}
                      variant={t.status === "COMPLETED" ? "success" : "warning"}
                    />
                  </td>
                  <td className="py-3 text-slate-500">
                    {t.scheduledAt ? formatDate(t.scheduledAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
