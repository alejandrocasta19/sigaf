import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";

export default async function AuditPage() {
  const user = requirePageAccess(await getSession(), {
    permission: "audit.read",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: user.organizationId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Auditoría</h1>
        <p className="text-sm text-slate-500">Registro de actividades del sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos recientes ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Usuario</th>
                <th className="pb-3 font-medium">Acción</th>
                <th className="pb-3 font-medium">Módulo</th>
                <th className="pb-3 font-medium">Entidad</th>
                <th className="pb-3 font-medium">IP</th>
                <th className="pb-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id} className="border-b border-slate-50">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={
                          row.user
                            ? `${row.user.firstName} ${row.user.lastName}`
                            : "Sistema"
                        }
                        className="h-7 w-7"
                      />
                      <span className="text-slate-700">
                        {row.user
                          ? `${row.user.firstName} ${row.user.lastName}`
                          : "Sistema"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 font-medium text-slate-800">{row.action}</td>
                  <td className="py-3">
                    <Badge variant="muted">{row.module}</Badge>
                  </td>
                  <td className="py-3 text-slate-500">
                    {row.entityType ? `${row.entityType} ${row.entityId?.slice(0, 8) ?? ""}` : "—"}
                  </td>
                  <td className="py-3 text-slate-500">{row.ipAddress ?? "—"}</td>
                  <td className="py-3 text-slate-500">{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
