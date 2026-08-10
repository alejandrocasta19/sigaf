import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";
import { formatDate } from "@/shared/kernel/utils";

export default async function DependenciesPage() {
  const user = requirePageAccess(await getSession(), { permission: "dependencies.read" });

  const deps = await prisma.dependency.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: { _count: { select: { users: true, documents: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dependencias</h1>
        <p className="text-sm text-slate-500">Estructura organizacional</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dependencias ({deps.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">Usuarios</th>
                <th className="pb-3 font-medium">Documentos</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Creada</th>
              </tr>
            </thead>
            <tbody>
              {deps.map((d) => (
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="py-3 font-medium">{d.code}</td>
                  <td className="py-3 text-slate-800">{d.name}</td>
                  <td className="py-3 text-slate-600">{d._count.users}</td>
                  <td className="py-3 text-slate-600">{d._count.documents}</td>
                  <td className="py-3">
                    <StatusBadge label={d.active ? "Activa" : "Inactiva"} variant={d.active ? "success" : "muted"} />
                  </td>
                  <td className="py-3 text-slate-500">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
