import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { RolesManager } from "@/modules/identity/ui/roles-manager";

export default async function RolesPage() {
  const user = requirePageAccess(await getSession(), {
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN"],
  });

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
      },
      orderBy: { accessLevel: "desc" },
    }),
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] }),
  ]);

  const canEdit = ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode);
  const canDelete = user.roleCode === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roles y permisos</h1>
        <p className="text-sm text-slate-500">
          Edita roles, ajusta permisos o elimina perfiles sin usuarios asignados
        </p>
      </div>

      <RolesManager
        initialRoles={roles}
        permissions={permissions}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}

