import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatDate } from "@/shared/kernel/utils";
import {
  documentStatusLabel,
  documentStatusVariant,
  archivalPhaseLabel,
  archivalPhaseVariant,
  StatusBadge,
} from "@/shared/list/status-labels";
import type { Prisma } from "@prisma/client";

export default async function DocumentsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const where: Prisma.DocumentWhereInput = {
    organizationId: user.organizationId,
    deletedAt: null,
  };
  if (user.roleCode === "DEPT_HEAD" && user.dependencyId) {
    where.dependencyId = user.dependencyId;
  }
  if (user.roleCode === "DEPT_WORKER" && user.dependencyId) {
    where.dependencyId = user.dependencyId;
  } 

  const documents = await prisma.document.findMany({
    where,
    include: {
      dependency: true,
      expediente: true,
      _count: { select: { versions: true, attachments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const canCreate = ["DEPT_WORKER", "DEPT_HEAD", "DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(
    user.roleCode
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Documentos</h1>
          <p className="text-sm text-slate-500">
            Registro, versiones y anexos · flujo de aprobación por dependencia
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {canCreate && (
            <Link
              href="/documents/new"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 sm:py-2"
            >
              Cargar documento
            </Link>
          )}
          <Link
            href="/reports"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:py-2"
          >
            Importar / Exportar
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentos registrados ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">Dependencia</th>
                <th className="pb-3 font-medium">Expediente</th>
                <th className="pb-3 font-medium">Fase AGN</th>
                <th className="pb-3 font-medium">Versiones</th>
                <th className="pb-3 font-medium">Anexos</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                  <td className="py-3">
                    <Link
                      href={`/documents/${d.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {d.code}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-800">
                    <Link href={`/documents/${d.id}`} className="hover:underline">
                      {d.name}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-600">{d.dependency.name}</td>
                  <td className="py-3 text-slate-500">{d.expediente?.code ?? "—"}</td>
                  <td className="py-3">
                    <StatusBadge
                      label={archivalPhaseLabel(d.archivalPhase)}
                      variant={archivalPhaseVariant(d.archivalPhase)}
                    />
                  </td>
                  <td className="py-3 text-slate-600">{d._count.versions}</td>
                  <td className="py-3 text-slate-600">{d._count.attachments}</td>
                  <td className="py-3">
                    <StatusBadge
                      label={documentStatusLabel(d.status)}
                      variant={documentStatusVariant(d.status)}
                    />
                  </td>
                  <td className="py-3 text-slate-500">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No hay documentos registrados
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
