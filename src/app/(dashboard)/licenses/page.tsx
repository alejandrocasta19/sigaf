import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";
import { formatDate } from "@/shared/kernel/utils";

export default async function LicensesPage() {
  const user = requirePageAccess(await getSession(), {
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN"],
  });

  const licenses = await prisma.license.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Licencias</h1>
        <p className="text-sm text-slate-500">Planes y asientos del sistema</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {licenses.map((l) => (
          <Card key={l.id}>
            <CardHeader>
              <CardTitle>Plan {l.plan}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-mono text-xs text-slate-500">{l.licenseKey}</p>
              <p className="text-slate-600">Asientos: {l.seats}</p>
              <p className="text-slate-600">
                Vence: {l.expiresAt ? formatDate(l.expiresAt) : "Sin vencimiento"}
              </p>
              <StatusBadge label={l.active ? "Activa" : "Inactiva"} variant={l.active ? "success" : "danger"} />
            </CardContent>
          </Card>
        ))}
        {licenses.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-slate-500">
              No hay licencias registradas
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
