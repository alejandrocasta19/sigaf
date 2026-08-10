import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatNumber } from "@/shared/kernel/utils";

export default async function InventoriesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const orgId = user.organizationId;
  const depFilter =
    user.roleCode === "DEPT_HEAD" && user.dependencyId
      ? { dependencyId: user.dependencyId }
      : {};

  const [docCount, expCount, boxCount, folderCount, byDep] = await Promise.all([
    prisma.document.count({ where: { organizationId: orgId, deletedAt: null, ...depFilter } }),
    prisma.expediente.count({ where: { organizationId: orgId, deletedAt: null, ...depFilter } }),
    prisma.box.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.folder.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.document.groupBy({
      by: ["dependencyId"],
      where: { organizationId: orgId, deletedAt: null, ...depFilter },
      _count: { _all: true },
    }),
  ]);

  const deps = await prisma.dependency.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, code: true },
  });
  const depMap = Object.fromEntries(deps.map((d) => [d.id, d]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventarios</h1>
          <p className="text-sm text-slate-500">Resumen del archivo + FUID (plantilla AGN)</p>
        </div>
        <a
          href="/api/v1/inventories/fuid"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Descargar FUID (Excel)
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Documentos</p>
            <p className="text-2xl font-bold text-slate-900">{formatNumber(docCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Expedientes</p>
            <p className="text-2xl font-bold text-slate-900">{formatNumber(expCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Cajas</p>
            <p className="text-2xl font-bold text-slate-900">{formatNumber(boxCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Carpetas</p>
            <p className="text-2xl font-bold text-slate-900">{formatNumber(folderCount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentos por dependencia</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Dependencia</th>
                <th className="pb-3 font-medium">Total documentos</th>
              </tr>
            </thead>
            <tbody>
              {byDep.map((row) => (
                <tr key={row.dependencyId} className="border-b border-slate-50">
                  <td className="py-3 font-medium">
                    {depMap[row.dependencyId]?.name ?? row.dependencyId}
                  </td>
                  <td className="py-3 text-slate-600">{formatNumber(row._count._all)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
