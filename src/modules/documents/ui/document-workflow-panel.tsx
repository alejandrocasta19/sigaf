"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatDate } from "@/shared/kernel/utils";
import { workflowActionLabel } from "@/shared/list/status-labels";
import type { DocumentStatus, WorkflowAction } from "@prisma/client";

type EventItem = {
  id: string;
  action: WorkflowAction;
  fromStatus: DocumentStatus | null;
  toStatus: DocumentStatus | null;
  observations: string | null;
  createdAt: string | Date;
  actor: { firstName: string; lastName: string } | null;
};

export function DocumentWorkflowPanel({
  documentId,
  status,
  workflowNotes,
  events,
  roleCode,
}: {
  documentId: string;
  status: DocumentStatus;
  workflowNotes: string | null;
  events: EventItem[];
  roleCode: string;
}) {
  const router = useRouter();
  const [observations, setObservations] = useState("");
  const [busy, setBusy] = useState(false);

  const canDept =
    roleCode === "DEPT_HEAD" &&
    ["PENDING_REVIEW", "IN_REVIEW_DEPT", "REJECTED_ARCHIVE"].includes(status);
  const canArchive =
    (roleCode === "DOC_ADMIN" || roleCode === "SUPER_ADMIN") &&
    ["APPROVED_DEPT", "IN_REVIEW_ARCHIVE"].includes(status);
  const canResubmit =
    (roleCode === "DEPT_WORKER" || roleCode === "DEPT_HEAD") &&
    status === "REJECTED_DEPT";

  async function run(action: string, requireNotes = false) {
    if (requireNotes && !observations.trim()) {
      toast.error("Indique observaciones");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/documents/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          documentId,
          observations: observations.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error");
      toast.success("Flujo actualizado");
      setObservations("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(canDept || canArchive || canResubmit) && (
        <Card>
          <CardHeader>
            <CardTitle>Acciones de aprobación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflowNotes && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Últimas observaciones: {workflowNotes}
              </p>
            )}
            {(canDept || canArchive) && (
              <>
                <Label htmlFor="wf-notes">Observaciones</Label>
                <textarea
                  id="wf-notes"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {canDept && (
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => run("approve_dept")}
                  >
                    <Check className="mr-1 h-4 w-4" /> Aprobar dependencia
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="border-red-200 text-red-700"
                    onClick={() => run("reject_dept", true)}
                  >
                    <X className="mr-1 h-4 w-4" /> Rechazar
                  </Button>
                </>
              )}
              {canArchive && (
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => run("approve_archive")}
                  >
                    <Check className="mr-1 h-4 w-4" /> Validar e archivar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="border-red-200 text-red-700"
                    onClick={() => run("reject_archive", true)}
                  >
                    <X className="mr-1 h-4 w-4" /> Devolver al Jefe
                  </Button>
                </>
              )}
              {canResubmit && (
                <Button size="sm" disabled={busy} onClick={() => run("resubmit")}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Reenviar a revisión
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className={canDept || canArchive || canResubmit ? "" : "lg:col-span-2"}>
        <CardHeader>
          <CardTitle>Historial del flujo</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">Sin eventos de workflow registrados.</p>
          ) : (
            <ol className="space-y-3 border-l border-slate-200 pl-4">
              {events.map((ev) => (
                <li key={ev.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <p className="font-medium text-slate-800">
                    {workflowActionLabel(ev.action)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ev.actor
                      ? `${ev.actor.firstName} ${ev.actor.lastName}`
                      : "Sistema"}{" "}
                    · {formatDate(ev.createdAt)}
                  </p>
                  {ev.observations && (
                    <p className="mt-1 text-slate-600">{ev.observations}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
