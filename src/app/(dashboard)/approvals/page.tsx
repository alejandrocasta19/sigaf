import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { listWorkflowInbox } from "@/modules/documents";
import { WorkflowInbox } from "@/modules/documents/ui/workflow-inbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { prisma } from "@/shared/kernel/prisma";
import { formatDate } from "@/shared/kernel/utils";
import {
  transferStatusLabel,
  StatusBadge,
} from "@/shared/list/status-labels";
import { isLoanGestora } from "@/modules/loans-transfers";
import { LoanApprovalsPanel } from "@/modules/loans-transfers/ui/loan-approvals-panel";
import { buildPreviewFiles } from "@/modules/documents/ui/build-preview-files";

export default async function ApprovalsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const inbox = await listWorkflowInbox(user);
  const mode =
    user.roleCode === "DOC_ADMIN" || user.roleCode === "SUPER_ADMIN"
      ? "archive"
      : user.roleCode === "DEPT_WORKER"
        ? "worker"
        : "dept";

  const title =
    mode === "archive"
      ? "Revisión archivística"
      : mode === "worker"
        ? "Mi bandeja documental"
        : "Aprobaciones de dependencia";

  const subtitle =
    mode === "archive"
      ? "Documentos aprobados por Jefe de Dependencia pendientes de validación TRD/TVD/CCD"
      : mode === "worker"
        ? "Seguimiento de documentos cargados y rechazos por corregir"
        : "Documentos pendientes de revisión en su dependencia";

  const showLoanApprovals = isLoanGestora(user);
  const showTransfers =
    user.roleCode === "DEPT_HEAD" ||
    user.roleCode === "DOC_ADMIN" ||
    user.roleCode === "SUPER_ADMIN" ||
    user.roleCode === "SYSTEM_ADMIN";

  const [loans, transfers] = await Promise.all([
    showLoanApprovals
      ? prisma.loan.findMany({
          where: {
            organizationId: user.organizationId,
            status: "REQUESTED",
          },
          include: {
            document: {
              include: {
                versions: {
                  orderBy: { version: "desc" },
                  take: 5,
                  select: { id: true, version: true, filePath: true },
                },
                attachments: {
                  take: 10,
                  select: { id: true, name: true, filePath: true, mimeType: true },
                },
              },
            },
            requester: true,
          },
          orderBy: { requestedAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    showTransfers
      ? prisma.transfer.findMany({
          where: { organizationId: user.organizationId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Flujo de aprobación documental ({inbox.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowInbox
            items={JSON.parse(JSON.stringify(inbox))}
            mode={mode}
          />
        </CardContent>
      </Card>

      {showLoanApprovals && (
        <Card>
          <CardHeader>
            <CardTitle>Préstamos por aprobar ({loans.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <LoanApprovalsPanel
              loans={loans.map((l) => ({
                id: l.id,
                code: l.code,
                status: l.status,
                requestedAt: l.requestedAt.toISOString(),
                document: {
                  id: l.document.id,
                  name: l.document.name,
                  code: l.document.code,
                  previewFiles: buildPreviewFiles({
                    id: l.document.id,
                    code: l.document.code,
                    filePath: l.document.filePath,
                    versions: l.document.versions,
                    attachments: l.document.attachments,
                  }),
                },
                requester: {
                  firstName: l.requester.firstName,
                  lastName: l.requester.lastName,
                },
              }))}
            />
          </CardContent>
        </Card>
      )}

      {showTransfers && (
        <Card>
          <CardHeader>
            <CardTitle>Transferencias pendientes ({transfers.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="pb-3 font-medium">Código</th>
                  <th className="pb-3 font-medium">Título</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Creada</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="py-3 font-medium">{t.code}</td>
                    <td className="py-3">{t.title}</td>
                    <td className="py-3">
                      <StatusBadge
                        label={transferStatusLabel(t.status)}
                        variant="warning"
                      />
                    </td>
                    <td className="py-3 text-slate-500">
                      {formatDate(t.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
