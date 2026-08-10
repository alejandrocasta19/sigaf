import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ModulesSettingsForm } from "@/modules/system-admin/ui/modules-settings-form";

const DEFAULT_MODULES = [
  { name: "Gestión documental", key: "documents", active: true },
  { name: "Expedientes", key: "expedientes", active: true },
  { name: "Archivo físico", key: "physical-archive", active: true },
  { name: "Préstamos", key: "loans", active: true },
  { name: "Transferencias", key: "transfers", active: true },
  { name: "Digitalización", key: "digitize", active: true },
  { name: "Firma digital", key: "signatures", active: true },
  { name: "Reportes", key: "reports", active: true },
];

export default async function SettingsModulesPage() {
  const user = requirePageAccess(await getSession(), {
    permission: "settings.read",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  const setting = await prisma.systemSetting.findFirst({
    where: { organizationId: user.organizationId, key: "modules.enabled" },
  });
  const saved = (setting?.value as Record<string, boolean> | null) ?? {};
  const rows = DEFAULT_MODULES.map((m) => ({
    ...m,
    active: saved[m.key] ?? m.active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Módulos</h1>
        <p className="text-sm text-slate-500">Activación persistida en SystemSetting</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Módulos disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <ModulesSettingsForm initial={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
