import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { ROLE_THEME } from "@/shared/kernel/types";
import { formatDate } from "@/shared/kernel/utils";

export default async function ProfilePage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    omit: { passwordHash: true, mfaSecret: true },
    include: { role: true, dependency: true, organization: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi perfil</h1>
        <p className="text-sm text-slate-500">Información de su cuenta</p>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="flex items-start gap-6 p-6">
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
