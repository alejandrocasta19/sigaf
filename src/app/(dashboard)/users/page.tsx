import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { UsersManager } from "@/modules/identity/ui/users-manager";
import { listUsers } from "@/modules/identity";
import Link from "next/link";

export default async function UsersPage() {
  const session = await getSession();
  const user = requirePageAccess(session, {
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  const canManage = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"].includes(user.roleCode);

  const [{ items: users }, roles, dependencies] = await Promise.all([
    listUsers(user, { take: 100 }),
    prisma.role.findMany({ orderBy: { accessLevel: "desc" } }),
    prisma.dependency.findMany({
      where: { organizationId: user.organizationId, deletedAt: null, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Usuarios</h1>
        <p className="text-sm text-slate-500">
          Crea usuarios (nombre, correo, contraseña), cambia roles y elimina cuentas.
          Las dependencias se gestionan en{" "}
          <Link href="/dependencies" className="font-medium text-blue-700 hover:underline">
            Dependencias
          </Link>
          .
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
