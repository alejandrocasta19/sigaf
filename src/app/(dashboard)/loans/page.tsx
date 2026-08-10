import { getSession, hasPermission } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { listLoans, isLoanGestora } from "@/modules/loans-transfers";
import { LoansManager } from "@/modules/loans-transfers/ui/loans-manager";
import { buildPreviewFiles } from "@/modules/documents/ui/build-preview-files";

export default async function LoansPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!hasPermission(user, "loans.read") && !isLoanGestora(user)) {
    redirect("/dashboard");
  }

  const loans = await listLoans(user);
  const serialized = loans.map((l) => ({
    id: l.id,
    code: l.code,
    status: l.status,
    notes: l.notes,
    requestedAt: l.requestedAt.toISOString(),
    dueDate: l.dueDate?.toISOString() ?? null,
    approvedAt: l.approvedAt?.toISOString() ?? null,
    returnedAt: l.returnedAt?.toISOString() ?? null,
    requesterId: l.requesterId,
    document: {
      id: l.document.id,
      code: l.document.code,
      name: l.document.name,
      dependency: { name: l.document.dependency.name },
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
    approver: l.approver
      ? { firstName: l.approver.firstName, lastName: l.approver.lastName }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Préstamos</h1>
        <p className="text-sm text-slate-500">
          Solicitud → aprobación por Gestión Documental → entrega por 24 horas →
          devolución o vencimiento
        </p>
      </div>

      <LoansManager
        loans={serialized}
        currentUserId={user.id}
        roleCode={user.roleCode}
        canCreate={hasPermission(user, "loans.create")}
        canApprove={hasPermission(user, "loans.approve") && isLoanGestora(user)}
      />
    </div>
  );
}
