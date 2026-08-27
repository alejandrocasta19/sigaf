import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";
import { formatDate } from "@/shared/kernel/utils";

export default async function OrganizationsPage() {
  const user = requirePageAccess(await getSession(), {
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN"],
  });

  const orgs =
    user.roleCode === "SUPER_ADMIN"
      ? await prisma.organization.findMany({ orderBy: { name: "asc" } })
      : await prisma.organization.findMany({ where: { id: user.organizationId } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Organizaciones</h1>
        <p className="text-sm text-slate-500">Entidades y tenencia del sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizaciones ({orgs.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">NIT</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Creada</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b border-slate-50">
                  <td className="py-3 font-medium text-slate-800">{o.name}</td>
                  <td className="py-3 text-slate-600">{o.nit ?? "—"}</td>
                  <td className="py-3">
                    <StatusBadge label={o.active ? "Activa" : "Inactiva"} variant={o.active ? "success" : "danger"} />
                  </td>
                  <td className="py-3 text-slate-500">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
