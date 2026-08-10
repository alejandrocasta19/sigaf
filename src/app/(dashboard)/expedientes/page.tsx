import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatDate } from "@/shared/kernel/utils";
import {
  documentStatusLabel,
  documentStatusVariant,
  StatusBadge,
} from "@/shared/list/status-labels";
import type { Prisma } from "@prisma/client";
import { CreateExpedienteForm } from "@/modules/expedientes/ui/create-expediente-form";

export default async function ExpedientesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const where: Prisma.ExpedienteWhereInput = {
    organizationId: user.organizationId,
    deletedAt: null,
  };
  if (
    (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER") &&
    user.dependencyId
  ) {
    where.dependencyId = user.dependencyId;
  }

  const canCreate = user.roleCode !== "CONSULT_USER";

  const [expedientes, dependencies] = await Promise.all([
    prisma.expediente.findMany({
      where,
      include: {
        dependency: true,
        responsible: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.dependency.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        ...(user.dependencyId &&
        (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER")
          ? { id: user.dependencyId }
          : {}),
      },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Expedientes</h1>
        <p className="text-sm text-slate-500">Gestión de expedientes documentales</p>
      </div>

      {canCreate && (
        <CreateExpedienteForm
          dependencies={dependencies.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
          defaultDependencyId={user.dependencyId}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expedientes ({expedientes.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">Dependencia</th>
                <th className="pb-3 font-medium">Documentos</th>
                <th className="pb-3 font-medium">Responsable</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Apertura</th>
              </tr>
            </thead>
            <tbody>
              {expedientes.map((e) => (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="py-3">
                    <Link
                      href={`/expedientes/${e.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {e.code}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-800">{e.name}</td>
                  <td className="py-3 text-slate-600">{e.dependency.name}</td>
                  <td className="py-3 text-slate-600">{e._count.documents}</td>
                  <td className="py-3 text-slate-600">
                    {e.responsible
                      ? `${e.responsible.firstName} ${e.responsible.lastName}`
                      : "—"}
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      label={documentStatusLabel(e.status)}
                      variant={documentStatusVariant(e.status)}
                    />
                  </td>
                  <td className="py-3 text-slate-500">{formatDate(e.openedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
