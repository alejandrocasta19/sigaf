import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";

const integrations = [
  { name: "API REST v1", desc: "Endpoints documentados bajo /api/v1", status: "Activo" },
  { name: "Webhooks", desc: "Notificaciones de eventos del sistema", status: "Próximamente" },
  { name: "Active Directory / LDAP", desc: "Autenticación corporativa", status: "Próximamente" },
  { name: "Almacenamiento S3", desc: "Archivos digitalizados en la nube", status: "Próximamente" },
  { name: "Correo SMTP", desc: "Notificaciones por email", status: "Próximamente" },
];

export default async function SettingsIntegrationsPage() {
  requirePageAccess(await getSession(), {
    permission: "settings.read",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integraciones</h1>
        <p className="text-sm text-slate-500">Conectores y APIs externas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integraciones disponibles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrations.map((i) => (
            <div
              key={i.name}
              className="flex items-center justify-between rounded-lg border border-slate-100 p-4"
            >
              <div>
                <p className="font-medium text-slate-800">{i.name}</p>
                <p className="text-xs text-slate-500">{i.desc}</p>
              </div>
              <StatusBadge
                label={i.status}
                variant={i.status === "Activo" ? "success" : "muted"}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
