import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { USER_PROFILE_SELECT } from "@/shared/kernel/user-privacy";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { ROLE_THEME } from "@/shared/kernel/types";
import { formatDate } from "@/shared/kernel/utils";
import { ChangePasswordForm } from "@/modules/identity/ui/change-password-form";
import { MfaSetupPanel } from "@/modules/system-admin/ui/mfa-setup-panel";

export default async function ProfilePage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: USER_PROFILE_SELECT,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Mi perfil y preferencias</h1>
        <p className="text-sm text-slate-500">
          Opciones personales de su cuenta. No incluye parámetros del sistema.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Datos de la cuenta</CardTitle>
        </CardHeader>
        <CardContent className="flex items-start gap-6">
          <Avatar name={user.fullName} src={user.avatarUrl} className="h-20 w-20 text-lg" />
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{user.fullName}</h2>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{ROLE_THEME[user.roleCode]?.label ?? user.roleName}</Badge>
              {user.dependencyName && <Badge variant="muted">{user.dependencyName}</Badge>}
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Organización</dt>
                <dd className="font-medium">{user.organizationName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Estado</dt>
                <dd className="font-medium">{dbUser?.status ?? "ACTIVE"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Último acceso</dt>
                <dd className="font-medium">
                  {dbUser?.lastLoginAt ? formatDate(dbUser.lastLoginAt) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Nivel de acceso</dt>
                <dd className="font-medium">{user.accessLevel}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordForm />

      <div className="max-w-2xl">
        <MfaSetupPanel />
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Preferencias rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-500">
            Accesos personales de su cuenta. La configuración del sistema solo está disponible para
            administradores.
          </p>
          <a
            href="/notifications"
            className="inline-flex rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
          >
            Ver notificaciones
          </a>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Permisos asignados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {user.permissions.map((p) => (
              <Badge key={p} variant="muted">
                {p}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
