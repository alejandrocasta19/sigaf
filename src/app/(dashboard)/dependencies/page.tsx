import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { isAdminRole } from "@/modules/identity";
import { DependenciesManager } from "@/modules/identity/ui/dependencies-manager";

export default async function DependenciesPage() {
  const user = requirePageAccess(await getSession(), {
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  const deps = await prisma.dependency.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: { _count: { select: { users: true, documents: true, expedientes: true } } },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Dependencias</h1>
        <p className="text-sm text-slate-500">
          Oficinas y secciones productoras de la entidad. El código se usa en la TRD y en los
          expedientes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estructura organizacional ({deps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DependenciesManager
            initialDeps={JSON.parse(JSON.stringify(deps))}
            canManage={isAdminRole(user)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
