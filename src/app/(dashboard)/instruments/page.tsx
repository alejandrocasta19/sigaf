import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";
import { InstrumentsAdminPanel } from "@/modules/archival-instruments/ui/instruments-admin-panel";

export default async function InstrumentsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const canManage = ["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode);

  const instruments = await prisma.archivalInstrument.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { type: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Instrumentos Archivísticos</h1>
          <p className="text-sm text-slate-500">TRD, TVD, CCD, PGD y políticas documentales</p>
        </div>
        <Link
          href="/trd"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Abrir Gestión de TRD
        </Link>
      </div>

      {canManage && <InstrumentsAdminPanel />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {instruments.map((i) => (
          <Card key={i.id} className={i.type === "TRD" ? "border-emerald-300" : undefined}>
            <CardHeader>
              <Badge variant={i.type === "TRD" ? "success" : "info"}>{i.type}</Badge>
              <CardTitle className="mt-2">{i.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-slate-600">
              <p>Versión: {i.version}</p>
              <p>Series: {i.seriesCount}</p>
              <p>Actualizado: {formatDate(i.lastUpdated)}</p>
              {i.filePath && (
                <p className="truncate text-xs text-slate-500">Archivo: {i.filePath}</p>
              )}
              {i.type === "TRD" && (
                <Link href="/trd" className="inline-block pt-2 text-emerald-700 hover:underline">
                  Ver tabla de retención →
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
