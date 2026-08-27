import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { locationLevelLabel, listPhysicalInventories } from "@/modules/physical-archive";
import { PhysicalArchivePanel } from "@/modules/physical-archive/ui/physical-archive-panel";
import { PhysicalArchiveManager } from "@/modules/physical-archive/ui/physical-archive-manager";
import { formatDate } from "@/shared/kernel/utils";
import { GlossaryTip } from "@/modules/archival-instruments/ui/glossary-tip";

export default async function PhysicalArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { box: highlightBox } = await searchParams;

  const canManage = ["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEPT_HEAD"].includes(
    user.roleCode
  );

  const [boxes, folders, locations, inventories, expedientes] = await Promise.all([
    prisma.box.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      include: { location: true, _count: { select: { folders: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.folder.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      include: { box: true, _count: { select: { documents: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.location.findMany({
      where: { organizationId: user.organizationId, active: true },
      orderBy: { code: "asc" },
    }),
    listPhysicalInventories(user),
    prisma.expediente.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, code: true, name: true, subject: true, boxCode: true, folderNumber: true },
      orderBy: { code: "asc" },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">
          Archivo Físico
          <GlossaryTip term="Archivo" />
        </h1>
        <p className="text-sm text-slate-500">
          Edificio → Piso → Sala → Estantería → Nivel → Caja → Carpeta → Expediente
        </p>
      </div>

      {canManage && (
        <PhysicalArchiveManager
          locations={locations.map((l) => ({
            id: l.id,
            code: l.code,
            name: l.name,
            level: l.level,
            parentId: l.parentId,
          }))}
          boxes={boxes.map((b) => ({ id: b.id, code: b.code }))}
          folders={folders.map((f) => ({ id: f.id, code: f.code, boxId: f.boxId }))}
          expedientes={expedientes}
        />
      )}

      {canManage && (
        <PhysicalArchivePanel
          boxes={boxes.map((b) => ({ id: b.id, code: b.code }))}
          folders={folders.map((f) => ({ id: f.id, code: f.code }))}
        />
      )}

      {inventories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inventarios formales ({inventories.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="pb-2 font-medium">Código</th>
                  <th className="pb-2 font-medium">Título</th>
                  <th className="pb-2 font-medium">Ítems</th>
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Archivo</th>
                </tr>
              </thead>
              <tbody>
                {inventories.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50">
                    <td className="py-2 font-medium">{inv.code}</td>
                    <td className="py-2">{inv.title}</td>
                    <td className="py-2">{inv.itemCount}</td>
                    <td className="py-2 text-slate-500">{formatDate(inv.createdAt)}</td>
                    <td className="py-2 text-xs text-slate-500">{inv.filePath ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ubicaciones ({locations.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {locations.map((loc) => (
              <div key={loc.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-800">{loc.name}</p>
                <p className="text-xs text-slate-500">
                  {loc.code} · {locationLevelLabel(loc.level)}
                </p>
              </div>
            ))}
            {locations.length === 0 && (
              <p className="text-sm text-slate-500">Sin ubicaciones registradas</p>
            )}
          </CardContent>
        </Card>

        <Card id="cajas">
          <CardHeader>
            <CardTitle>Cajas ({boxes.length})</CardTitle>
            {highlightBox && (
              <p className="text-xs text-teal-700">
                Resaltada desde escáner QR: <strong>{highlightBox}</strong>
              </p>
            )}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="pb-2 font-medium">Código</th>
                  <th className="pb-2 font-medium">Ubicación</th>
                  <th className="pb-2 font-medium">Capacidad</th>
                  <th className="pb-2 font-medium">Etiqueta</th>
                </tr>
              </thead>
              <tbody>
                {boxes.map((b) => {
                  const active =
                    !!highlightBox && b.code.toLowerCase() === highlightBox.toLowerCase();
                  return (
                    <tr
                      key={b.id}
                      id={active ? `box-${b.code}` : undefined}
                      className={
                        active
                          ? "border-b border-teal-200 bg-teal-50"
                          : "border-b border-slate-50"
                      }
                    >
                      <td className="py-2 font-medium">
                        <Link
                          href={`/physical-archive/boxes/${b.id}`}
                          className="text-blue-700 hover:underline"
                        >
                          {b.code}
                        </Link>
                      </td>
                      <td className="py-2 text-slate-600">{b.location?.name ?? "—"}</td>
                      <td className="py-2 text-slate-600">
                        {b.currentCount}/{b.capacity}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/physical-archive/boxes/${b.id}`}
                            className="text-xs text-teal-700 hover:underline"
                          >
                            Ver ficha
                          </Link>
                          <a
                            href={`/api/v1/boxes/${b.id}/label`}
                            className="text-xs text-blue-700 hover:underline"
                          >
                            Etiqueta PDF + QR
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carpetas ({folders.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="pb-2 font-medium">Código</th>
                  <th className="pb-2 font-medium">Caja</th>
                  <th className="pb-2 font-medium">Docs</th>
                </tr>
              </thead>
              <tbody>
                {folders.map((f) => (
                  <tr key={f.id} className="border-b border-slate-50">
                    <td className="py-2">
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: f.color }}
                      />
                      <span className="font-medium">{f.code}</span>
                    </td>
                    <td className="py-2 text-slate-600">{f.box?.code ?? "—"}</td>
                    <td className="py-2 text-slate-600">{f._count.documents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
