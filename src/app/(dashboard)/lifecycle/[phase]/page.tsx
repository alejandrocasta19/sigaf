import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ArchivalPhase } from "@prisma/client";
import { getSession } from "@/shared/kernel/auth";
import { notFound, redirect } from "next/navigation";
import { ARCHIVAL_PHASES, listByPhase } from "@/modules/loans-transfers";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { PhaseInventory } from "@/modules/loans-transfers/ui/phase-inventory";

const SLUG_MAP: Record<string, ArchivalPhase> = {
  management: "MANAGEMENT",
  gestion: "MANAGEMENT",
  central: "CENTRAL",
  historical: "HISTORICAL",
  historico: "HISTORICAL",
};

type Props = { params: Promise<{ phase: string }> };

export default async function LifecyclePhasePage({ params }: Props) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { phase: slug } = await params;
  const phase = SLUG_MAP[slug.toLowerCase()];
  if (!phase) notFound();

  const data = await listByPhase(user, phase);
  const meta = ARCHIVAL_PHASES[phase];
  const canUpload = user.roleCode !== "CONSULT_USER";
  const canComplete = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"].includes(user.roleCode);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/lifecycle"
          className="mb-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Ciclo vital
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={meta.badge}>{meta.phaseLabel}</Badge>
          <h1 className="text-2xl font-bold text-slate-900">{meta.name}</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{meta.description}</p>
        <p className="mt-1 text-xs text-slate-400">{meta.lawRef}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Documentos</p>
            <p className="text-2xl font-bold">{data.documents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Expedientes</p>
            <p className="text-2xl font-bold">{data.expedientes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Responsabilidad</p>
            <p className="text-sm font-medium text-slate-800">{meta.responsibility}</p>
          </CardContent>
        </Card>
      </div>

      {canUpload ? (
        <PhaseInventory
          phase={phase}
          documents={JSON.parse(JSON.stringify(data.documents))}
          expedientes={JSON.parse(JSON.stringify(data.expedientes))}
          canComplete={canComplete}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Inventario (solo consulta)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.documents.slice(0, 20).map((d) => (
              <div key={d.id} className="flex justify-between border-b border-slate-50 py-2">
                <span>{d.code} — {d.name}</span>
                <Link href={`/documents/${d.id}`} className="text-blue-600">Ver</Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
