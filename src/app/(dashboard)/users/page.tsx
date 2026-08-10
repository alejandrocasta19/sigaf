import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { UsersManager } from "@/modules/identity/ui/users-manager";

export default async function UsersPage() {
  const session = await getSession();
  const user = requirePageAccess(session, {
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  const canManage = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"].includes(user.roleCode);

  const [users, roles, dependencies] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      include: { role: true, dependency: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.role.findMany({ orderBy: { accessLevel: "desc" } }),
    prisma.dependency.findMany({
      where: { organizationId: user.organizationId, deletedAt: null, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-sm text-slate-500">
          Crea usuarios (nombre, correo, contraseña), cambia roles y elimina cuentas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de usuarios ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <UsersManager
            initialUsers={JSON.parse(JSON.stringify(users))}
            roles={roles.map((r) => ({ id: r.id, name: r.name, code: r.code }))}
            dependencies={dependencies.map((d) => ({ id: d.id, name: d.name }))}
            currentUserId={user.id}
            canManage={canManage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
