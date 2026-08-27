import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Settings, Shield, Boxes, Workflow, Plug } from "lucide-react";

export default async function SettingsPage() {
  const user = requirePageAccess(await getSession(), {
    permission: "settings.read",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  const settings = await prisma.systemSetting.findMany({
    where: { organizationId: user.organizationId },
    take: 20,
  });

  const links = [
    { href: "/settings/modules", label: "Módulos", icon: Boxes, desc: "Activar/desactivar módulos" },
    { href: "/settings/security", label: "Seguridad", icon: Shield, desc: "Políticas de acceso" },
    { href: "/settings/integrations", label: "Integraciones", icon: Plug, desc: "APIs y conectores" },
    { href: "/settings/workflows", label: "Flujos de trabajo", icon: Workflow, desc: "Aprobaciones y tareas" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Configuración</h1>
        <p className="text-sm text-slate-500">Parámetros generales de {user.organizationName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="transition hover:border-blue-200 hover:shadow-md">
              <CardHeader className="flex-row items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                  <l.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>{l.label}</CardTitle>
                  <p className="text-xs text-slate-500">{l.desc}</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Settings className="h-5 w-5 text-slate-500" />
          <CardTitle>Parámetros del sistema</CardTitle>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <p className="text-sm text-slate-500">No hay parámetros configurados</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="pb-2 font-medium">Clave</th>
                  <th className="pb-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="py-2 font-medium">{s.key}</td>
                    <td className="py-2 font-mono text-xs text-slate-600">
                      {JSON.stringify(s.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
