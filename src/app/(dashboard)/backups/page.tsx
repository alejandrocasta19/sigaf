import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { RunBackupButton } from "@/modules/system-admin/ui/run-backup-button";
import { StatusBadge } from "@/shared/list/status-labels";
import { formatDate } from "@/shared/kernel/utils";

export default async function BackupsPage() {
  const user = requirePageAccess(await getSession(), {
    permission: "backups.read",
    roles: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"],
  });

  const canBackup = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"].includes(user.roleCode);

  const backups = await prisma.backupRecord.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Copias de seguridad</h1>
          <p className="text-sm text-slate-500">
            Manifest de uploads + pg_dump si está disponible
          </p>
        </div>
        {canBackup && <RunBackupButton />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backups ({backups.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Archivo</th>
                <th className="pb-3 font-medium">Tamaño</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b border-slate-50">
                  <td className="py-3 font-mono text-xs text-slate-700">{b.filePath}</td>
                  <td className="py-3 text-slate-600">
                    {b.sizeBytes ? `${(b.sizeBytes / 1024 / 1024).toFixed(1)} MB` : "—"}
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      label={b.status}
                      variant={b.status === "COMPLETED" ? "success" : "warning"}
                    />
                  </td>
                  <td className="py-3 text-slate-500">{formatDate(b.createdAt)}</td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No hay respaldos registrados
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
