import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";
import { SecuritySettingsForm } from "@/modules/system-admin/ui/security-settings-form";
import { MfaSetupPanel } from "@/modules/system-admin/ui/mfa-setup-panel";

export default async function SettingsSecurityPage() {
  const user = requirePageAccess(await getSession(), {
    permission: "settings.read",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  const [policySetting, emailSetting] = await Promise.all([
    prisma.systemSetting.findFirst({
      where: { organizationId: user.organizationId, key: "security.policy" },
    }),
    prisma.systemSetting.findFirst({
      where: { organizationId: user.organizationId, key: "notifications.emailEnabled" },
    }),
  ]);

  const policy = (policySetting?.value as Record<string, unknown>) ?? {};
  const initial = {
    passwordMinLength: Number(policy.passwordMinLength ?? 6),
    mfaEnabled: Boolean(policy.mfaEnabled ?? false),
    ldapEnabled: Boolean(policy.ldapEnabled ?? false),
    emailNotifications: Boolean(
      emailSetting?.value === true ||
        (typeof emailSetting?.value === "object" && emailSetting?.value) ||
        policy.emailNotifications
    ),
  };

  const policies = [
    { name: "Autenticación JWT", desc: "Tokens con expiración configurada", status: "Activo" },
    { name: "Cookies HttpOnly", desc: "Protección XSS en sesiones", status: "Activo" },
    {
      name: "MFA TOTP",
      desc: "Autenticación en dos pasos por aplicación (Google Authenticator, etc.)",
      status: initial.mfaEnabled ? "Política org. activa" : "Opcional por usuario",
    },
    {
      name: "LDAP/AD",
      desc: "Flag de configuración (sin conector)",
      status: initial.ldapEnabled ? "Configurado" : "Deshabilitado",
    },
    {
      name: "Correo SMTP",
      desc: process.env.SMTP_HOST ? `Host ${process.env.SMTP_HOST}` : "SMTP_HOST no definido",
      status: process.env.SMTP_HOST ? "Disponible" : "Solo in-app",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Seguridad</h1>
        <p className="text-sm text-slate-500">Políticas de acceso y protección</p>
      </div>

      <SecuritySettingsForm initial={initial} />

      <MfaSetupPanel />

      <Card>
        <CardHeader>
          <CardTitle>Estado actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {policies.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between rounded-lg border border-slate-100 p-4"
            >
              <div>
                <p className="font-medium text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-500">{p.desc}</p>
              </div>
              <StatusBadge
                label={p.status}
                variant={
                  p.status === "Activo" || p.status === "Disponible" || p.status === "Configurado"
                    ? "success"
                    : "muted"
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
