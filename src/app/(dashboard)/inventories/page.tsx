import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { listDocumentInventories } from "@/modules/search-reports";
import { Card, CardContent } from "@/shared/ui/card";
import { formatNumber } from "@/shared/kernel/utils";
import { FuidInventoryPanel } from "@/modules/search-reports/ui/fuid-inventory-panel";

export default async function InventoriesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const orgId = user.organizationId;
  const depFilter =
    user.roleCode === "DEPT_HEAD" && user.dependencyId
      ? { dependencyId: user.dependencyId }
      : {};

  const [docCount, expCount, boxCount, folderCount, inventories] = await Promise.all([
    prisma.document.count({ where: { organizationId: orgId, deletedAt: null, ...depFilter } }),
    prisma.expediente.count({ where: { organizationId: orgId, deletedAt: null, ...depFilter } }),
    prisma.box.count({ where: { organizationId: orgId, deletedAt: null } }),
    prisma.folder.count({ where: { organizationId: orgId, deletedAt: null } }),
    listDocumentInventories(user),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Inventario documental</h1>
          <p className="text-sm text-slate-500">FUID oficial — Acuerdo AGN 001 de 2024, Anexo 3</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/v1/inventories/fuid?objeto=Inventario%20documental"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Exportar FUID AGN (Excel)
          </a>
          <a
            href="/api/v1/inventories/fuid?format=pdf&objeto=Inventario%20documental"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
          >
            Exportar FUID AGN (PDF)
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Documentos</p>
            <p className="page-title text-xl font-bold text-slate-900 sm:text-2xl">{formatNumber(docCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Expedientes</p>
            <p className="page-title text-xl font-bold text-slate-900 sm:text-2xl">{formatNumber(expCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Cajas</p>
            <p className="page-title text-xl font-bold text-slate-900 sm:text-2xl">{formatNumber(boxCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Carpetas</p>
            <p className="page-title text-xl font-bold text-slate-900 sm:text-2xl">{formatNumber(folderCount)}</p>
          </CardContent>
        </Card>
      </div>

      <FuidInventoryPanel
        initialInventories={inventories.map((inv) => ({
          id: inv.id,
          code: inv.code,
          title: inv.title,
          transferCode: inv.transferCode,
          status: inv.status,
          createdAt: inv.createdAt,
          _count: inv._count,
        }))}
      />
    </div>
  );
}
