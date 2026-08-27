import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";

const workflows = [
  { name: "Aprobación de préstamos", steps: "Solicitud → Revisión → Aprobación → Devolución", active: true },
  { name: "Transferencia documental", steps: "Borrador → Pendiente → En progreso → Completada", active: true },
  { name: "Digitalización", steps: "Captura → OCR → Validación → Indexación", active: true },
  { name: "Cierre de expediente", steps: "Revisión → Aprobación → Cierre → Archivo", active: true },
  { name: "Eliminación documental", steps: "Solicitud → TRD → Aprobación → Eliminación", active: false },
];

export default async function SettingsWorkflowsPage() {
  requirePageAccess(await getSession(), {
    permission: "settings.read",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Flujos de trabajo</h1>
        <p className="text-sm text-slate-500">Procesos de aprobación y automatización</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flujos configurados</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Flujo</th>
                <th className="pb-3 font-medium">Etapas</th>
                <th className="pb-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.name} className="border-b border-slate-50">
                  <td className="py-3 font-medium text-slate-800">{w.name}</td>
                  <td className="py-3 text-slate-600">{w.steps}</td>
                  <td className="py-3">
                    <StatusBadge
                      label={w.active ? "Activo" : "Inactivo"}
                      variant={w.active ? "success" : "muted"}
                    />
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
