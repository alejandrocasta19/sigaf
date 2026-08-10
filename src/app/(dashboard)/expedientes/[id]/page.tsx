import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/shared/kernel/auth";
import { getExpediente } from "@/modules/expedientes";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  documentStatusLabel,
  documentStatusVariant,
  StatusBadge,
} from "@/shared/list/status-labels";
import { formatDate } from "@/shared/kernel/utils";
import { EditExpedienteForm } from "@/modules/expedientes/ui/edit-expediente-form";

type Props = { params: Promise<{ id: string }> };

export default async function ExpedienteDetailPage({ params }: Props) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;
  const exp = await getExpediente(user, id);
  if (!exp) notFound();

  const canEdit = user.roleCode !== "CONSULT_USER";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/expedientes" className="text-sm text-blue-600 hover:underline">
          ← Expedientes
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{exp.name}</h1>
        <p className="text-sm text-slate-500">{exp.code}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-xs text-slate-500">Dependencia</p>
              <p className="font-medium">{exp.dependency.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Estado</p>
              <StatusBadge
                label={documentStatusLabel(exp.status)}
                variant={documentStatusVariant(exp.status)}
              />
            </div>
            <div>
              <p className="text-xs text-slate-500">Apertura</p>
              <p className="font-medium">{formatDate(exp.openedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Documentos</p>
              <p className="font-medium">{exp.documents?.length ?? 0}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Descripción</p>
              <p className="font-medium">{exp.description || "—"}</p>
            </div>
          </CardContent>
        </Card>

        {canEdit && (
          <EditExpedienteForm
            id={exp.id}
            name={exp.name}
            description={exp.description}
            status={exp.status}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentos del expediente</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-2 font-medium">Código</th>
                <th className="pb-2 font-medium">Nombre</th>
                <th className="pb-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(exp.documents ?? []).map((d) => (
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="py-2">
                    <Link href={`/documents/${d.id}`} className="text-blue-700 hover:underline">
                      {d.code}
                    </Link>
                  </td>
                  <td className="py-2">{d.name}</td>
                  <td className="py-2">
                    <StatusBadge
                      label={documentStatusLabel(d.status)}
                      variant={documentStatusVariant(d.status)}
                    />
                  </td>
                </tr>
              ))}
              {(exp.documents ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-500">
                    Sin documentos vinculados
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
