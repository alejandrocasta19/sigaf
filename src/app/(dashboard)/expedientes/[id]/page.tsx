import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/shared/kernel/auth";
import { getExpedienteArchivalDetail, getExpedienteReadiness } from "@/modules/expedientes";
import { finalDispositionLabel } from "@/modules/archival-instruments";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import {
  documentStatusLabel,
  documentStatusVariant,
  StatusBadge,
} from "@/shared/list/status-labels";
import { formatDate } from "@/shared/kernel/utils";
import { EditExpedienteForm } from "@/modules/expedientes/ui/edit-expediente-form";
import { ExpedienteArchivalHub } from "@/modules/expedientes/ui/expediente-archival-hub";

type Props = { params: Promise<{ id: string }> };

export default async function ExpedienteDetailPage({ params }: Props) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;
  const exp = await getExpedienteArchivalDetail(user, id);
  if (!exp) notFound();

  const [readiness, documentTypes] = await Promise.all([
    getExpedienteReadiness(user, id),
    prisma.documentType.findMany({
      where: { organizationId: user.organizationId, active: true, category: "TYPOLOGY" },
      orderBy: { name: "asc" },
    }),
  ]);

  const canEdit = user.roleCode !== "CONSULT_USER";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/expedientes" className="text-sm text-blue-600 hover:underline">
          ← Expedientes
        </Link>
        <h1 className="page-title mt-1 text-xl font-bold text-slate-900 sm:text-2xl break-words">
          {exp.subject ?? exp.name}
        </h1>
        <p className="font-mono text-sm text-slate-500">{exp.code}</p>
        {exp.series ? (
          <p className="text-sm text-slate-600">
            {exp.series.name}
            {exp.subseries ? ` → ${exp.subseries.name}` : ""}
          </p>
        ) : (
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
            <Badge variant="warning">Sin serie TRD</Badge>
            <span>Clasifique este expediente según la TRD activa.</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-xs text-slate-500">Dependencia (Sección)</p>
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
              <p className="text-xs text-slate-500">Tipo</p>
              <p className="font-medium">{exp.expedienteType ?? "Serie compuesta"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Año</p>
              <p className="font-medium">{exp.year ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Retención gestión</p>
              <p className="font-medium">{exp.appliedRetentionMgmt ?? "—"} años</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Disposición final</p>
              <p className="font-medium">
                {exp.appliedFinalDisposition
                  ? finalDispositionLabel(exp.appliedFinalDisposition)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Apertura</p>
              <p className="font-medium">{formatDate(exp.openedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Documentos</p>
              <p className="font-medium">{exp.documents?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        {canEdit && (
          <EditExpedienteForm
            id={exp.id}
            name={exp.name}
            description={exp.description}
            status={exp.status}
            version={exp.version}
          />
        )}
      </div>

      <ExpedienteArchivalHub
        canEdit={canEdit}
        documentTypes={documentTypes.map((t) => ({ id: t.id, name: t.name }))}
        transferReadiness={readiness}
        expediente={{
          id: exp.id,
          code: exp.code,
          name: exp.name,
          status: exp.status,
          subject: exp.subject,
          subsection: exp.subsection,
          expedienteType: exp.expedienteType,
          year: exp.year,
          foliationVerified: exp.foliationVerified,
          chronologicalOrder: exp.chronologicalOrder,
          folderNumber: exp.folderNumber,
          boxCode: exp.boxCode,
          folioStart: exp.folioStart,
          folioEnd: exp.folioEnd,
          dateStart: exp.dateStart,
          dateEnd: exp.dateEnd,
          appliedRetentionMgmt: exp.appliedRetentionMgmt,
          appliedRetentionCentral: exp.appliedRetentionCentral,
          appliedFinalDisposition: exp.appliedFinalDisposition,
          retentionStartEvent: exp.retentionStartEvent,
          retentionStartDate: exp.retentionStartDate,
          retentionDueAt: exp.retentionDueAt,
          organization: exp.organization,
          dependency: exp.dependency,
          series: exp.series,
          subseries: exp.subseries,
          documents: exp.documents.map((d) => ({
            id: d.id,
            code: d.code,
            name: d.name,
            folioCount: d.folioCount,
            documentDate: d.documentDate,
            sortOrder: d.sortOrder,
            support: d.support,
            electronicFormat: d.electronicFormat,
          })),
          processSteps: exp.processSteps,
          version: exp.version,
        }}
      />
    </div>
  );
}
