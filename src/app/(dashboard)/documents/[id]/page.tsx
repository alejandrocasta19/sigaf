import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/shared/kernel/auth";
import { getDocument, getDocumentTimeline } from "@/modules/documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";
import {
  documentStatusLabel,
  documentStatusVariant,
  archivalPhaseLabel,
  StatusBadge,
  lifecyclePathLabel,
} from "@/shared/list/status-labels";
import { DocumentFilesPanel } from "@/modules/documents/ui/document-files-panel";
import { DocumentWorkflowPanel } from "@/modules/documents/ui/document-workflow-panel";
import { DocumentFileViewer } from "@/modules/documents/ui/document-file-viewer";
import { buildPreviewFiles } from "@/modules/documents/ui/build-preview-files";
import { DocumentTimeline } from "@/modules/documents/ui/document-timeline";
import { ApplyTrdCalcButton } from "@/modules/archival-instruments/ui/apply-trd-calc-button";
import { DigitizeUploadButton } from "@/modules/documents/ui/digitize-upload-button";
import { SignDocumentButton } from "@/modules/documents/ui/sign-document-button";
import { GlossaryTip } from "@/modules/archival-instruments/ui/glossary-tip";
import { finalDispositionLabel } from "@/modules/archival-instruments";
import { ARCHIVAL_PHASES } from "@/modules/loans-transfers";

type Props = { params: Promise<{ id: string }> };

export default async function DocumentDetailPage({ params }: Props) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { id } = await params;
  const doc = await getDocument(user, id);
  if (!doc) notFound();

  const timeline = await getDocumentTimeline(user, id);

  const canUpload = user.roleCode !== "CONSULT_USER";
  const isReviewer =
    user.roleCode === "DEPT_HEAD" ||
    user.roleCode === "DOC_ADMIN" ||
    user.roleCode === "SUPER_ADMIN";
  const previewFiles = buildPreviewFiles({
    id: doc.id,
    code: doc.code,
    filePath: doc.filePath,
    versions: doc.versions,
    attachments: doc.attachments,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/documents"
            className="mb-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a documentos
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{doc.name}</h1>
          <p className="text-sm text-slate-500">{doc.code}</p>
        </div>
        <StatusBadge
          label={documentStatusLabel(doc.status)}
          variant={documentStatusVariant(doc.status)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Información del documento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field label="Dependencia" value={doc.dependency.name} />
            <Field label="Expediente" value={doc.expediente?.code ?? "—"} />
            <Field label="Serie" value={doc.series?.name ?? "—"} tip="Serie" />
            <Field label="Subserie" value={doc.subseries?.name ?? "—"} tip="Subserie" />
            <Field label="Tipo" value={doc.documentType?.name ?? "—"} />
            <Field
              label="Ciclo vital"
              value={lifecyclePathLabel({
                status: doc.status,
                archivalPhase: doc.archivalPhase,
                appliedFinalDisposition: doc.appliedFinalDisposition,
                deletedAt: doc.deletedAt,
              })}
            />
            <div>
              <p className="text-xs text-slate-500">
                Fase archivística (Ley 594)
                <GlossaryTip term="Archivo de Gestión" />
              </p>
              <p className="font-medium text-slate-800">
                {archivalPhaseLabel(doc.archivalPhase)}
              </p>
              <p className="text-[11px] text-slate-400">
                {ARCHIVAL_PHASES[doc.archivalPhase].phaseLabel} ·{" "}
                <Link
                  href={`/lifecycle/${doc.archivalPhase.toLowerCase()}`}
                  className="text-blue-600 hover:underline"
                >
                  Ver inventario
                </Link>
              </p>
            </div>
            <Field label="Folios" value={String(doc.folioCount)} />
            <Field label="QR" value={doc.qrCode} />
            <Field
              label="Retención AG/AC aplicada"
              tip="Archivo de Gestión"
              value={
                doc.appliedRetentionMgmt != null
                  ? `${doc.appliedRetentionMgmt} / ${doc.appliedRetentionCentral ?? "—"} años`
                  : "Sin calcular"
              }
            />
            <Field
              label="Disposición TRD"
              tip="Disposición final"
              value={
                doc.appliedFinalDisposition
                  ? finalDispositionLabel(doc.appliedFinalDisposition)
                  : "—"
              }
            />
            <Field
              label="Vence retención"
              value={doc.retentionDueAt ? formatDate(doc.retentionDueAt) : "—"}
            />
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <ApplyTrdCalcButton documentId={doc.id} />
              <SignDocumentButton documentId={doc.id} />
              {!doc.filePath && <DigitizeUploadButton documentId={doc.id} />}
            </div>
            <Field
              label="Responsable"
              value={
                doc.responsible
                  ? `${doc.responsible.firstName} ${doc.responsible.lastName}`
                  : "—"
              }
            />
            <Field
              label="Cargado por"
              value={
                doc.submittedBy
                  ? `${doc.submittedBy.firstName} ${doc.submittedBy.lastName}`
                  : "—"
              }
            />
            <Field label="Creado" value={formatDate(doc.createdAt)} />
            <Field
              label="Archivado"
              value={doc.archivedAt ? formatDate(doc.archivedAt) : "—"}
            />
            <div className="sm:col-span-2">
              <Field label="Descripción" value={doc.description || "—"} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Observaciones" value={doc.observations || "—"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen de archivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Versiones</span>
              <Badge variant="info">{doc.versions.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Anexos</span>
              <Badge variant="success">{doc.attachments.length}</Badge>
            </div>
            {isReviewer && (
              <p className="rounded-md bg-blue-50 px-2 py-2 text-xs text-blue-800">
                Revise el archivo abajo antes de aprobar o rechazar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <DocumentFileViewer
        files={previewFiles}
        title={
          isReviewer
            ? "Archivo para rectificación y decisión"
            : "Archivo del documento"
        }
      />

      <DocumentWorkflowPanel
        documentId={doc.id}
        status={doc.status}
        workflowNotes={doc.workflowNotes}
        events={JSON.parse(JSON.stringify(doc.workflowEvents))}
        roleCode={user.roleCode}
      />

      <Card>
        <CardHeader>
          <CardTitle>Historial unificado (auditoría / workflow / versiones)</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentTimeline events={timeline?.events ?? []} />
        </CardContent>
      </Card>

      <DocumentFilesPanel
        documentId={doc.id}
        versions={JSON.parse(JSON.stringify(doc.versions))}
        attachments={JSON.parse(JSON.stringify(doc.attachments))}
        canUpload={canUpload}
      />
    </div>
  );
}

function Field({
  label,
  value,
  tip,
}: {
  label: string;
  value: string;
  tip?: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">
        {label}
        {tip ? <GlossaryTip term={tip} /> : null}
      </p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}

