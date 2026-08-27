import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { WORKFLOW_INBOX_STATUSES } from "@/shared/kernel/document-lifecycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";
import { JobsRunnerPanel } from "@/modules/system-admin/ui/jobs-runner-panel";

export default async function TasksPage() {
  const user = requirePageAccess(await getSession(), {});

  const canRunJobs = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"].includes(user.roleCode);

  const [pendingLoans, pendingTransfers, pendingDocs, retentionDue] = await Promise.all([
    prisma.loan.count({
      where: { organizationId: user.organizationId, status: "REQUESTED" },
    }),
    prisma.transfer.count({
      where: { organizationId: user.organizationId, status: "PENDING" },
    }),
    prisma.document.count({
      where: {
        organizationId: user.organizationId,
        status: { in: WORKFLOW_INBOX_STATUSES },
        deletedAt: null,
      },
    }),
    prisma.document.count({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        retentionDueAt: { lte: new Date() },
        appliedFinalDisposition: "ELIMINATION",
      },
    }),
  ]);

  const tasks = [
    {
      title: "Aprobar préstamos",
      count: pendingLoans,
      href: "/loans",
      module: "Préstamos",
    },
    {
      title: "Transferencias pendientes",
      count: pendingTransfers,
      href: "/lifecycle",
      module: "Ciclo vital",
    },
    {
      title: "Bandeja de aprobación",
      count: pendingDocs,
      href: "/approvals",
      module: "Workflow",
    },
    {
      title: "Retención vencida",
      count: retentionDue,
      href: "/trd/disposals",
      module: "TRD",
    },
  ];

  const jobs = await prisma.job.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Tareas</h1>
        <p className="text-sm text-slate-500">
          Bandeja alineada al workflow y al ciclo AG → AC → AH
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tasks.map((t) => (
          <Link key={t.title} href={t.href}>
            <Card className="transition hover:border-blue-200 hover:shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="font-medium text-slate-800">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.module}</p>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {t.count}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {canRunJobs && <JobsRunnerPanel />}

      <Card>
        <CardHeader>
          <CardTitle>Trabajos recientes ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-slate-50">
                  <td className="py-3 font-medium">{j.type}</td>
                  <td className="py-3">
                    <Badge
                      variant={
                        j.status === "COMPLETED"
                          ? "success"
                          : j.status === "FAILED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {j.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-slate-500">{formatDate(j.createdAt)}</td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    Sin trabajos
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
