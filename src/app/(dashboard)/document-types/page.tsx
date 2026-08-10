import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";

export default async function DocumentTypesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const types = await prisma.documentType.findMany({
    where: { organizationId: user.organizationId },
    include: { _count: { select: { documents: true } } },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tipos documentales</h1>
        <p className="text-sm text-slate-500">Clasificación de documentos del archivo</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tipos registrados ({types.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">Documentos</th>
                <th className="pb-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="py-3 font-medium">{t.code}</td>
                  <td className="py-3 text-slate-800">{t.name}</td>
                  <td className="py-3 text-slate-600">{t._count.documents}</td>
                  <td className="py-3">
                    <StatusBadge label={t.active ? "Activo" : "Inactivo"} variant={t.active ? "success" : "muted"} />
                  </td>
                </tr>
              ))}
              {types.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No hay tipos documentales registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
