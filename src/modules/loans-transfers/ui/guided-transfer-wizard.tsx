"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { TRANSFER_GUIDED_STEPS } from "@/shared/kernel/archival-process";
import type { ExpedienteReadiness } from "@/shared/kernel/expediente-cycle";

type CheckKey =
  | "checklistRetentionMet"
  | "checklistDocumentSelection"
  | "checklistChronological"
  | "checklistFoliation"
  | "checklistBoxFolder"
  | "checklistInventory"
  | "checklistApproval";

const STEP_KEYS: CheckKey[] = [
  "checklistRetentionMet",
  "checklistDocumentSelection",
  "checklistChronological",
  "checklistFoliation",
  "checklistBoxFolder",
  "checklistInventory",
  "checklistApproval",
];

function deriveChecks(readiness: ExpedienteReadiness[]) {
  const foliationOk = (r: ExpedienteReadiness) => {
    const digital = r.checks.find((c) => c.key === "foliation")?.passed;
    const physical = r.checks.find((c) => c.key === "physicalFoliation")?.passed;
    return !!(digital && physical);
  };
  const allReady = readiness.length > 0 && readiness.every((r) => r.ready);
  return {
    checklistRetentionMet: readiness.every((r) => r.checks.find((c) => c.key === "retention")?.passed),
    checklistDocumentSelection: readiness.every((r) => r.documentCount > 0),
    checklistChronological: readiness.every((r) => r.checks.find((c) => c.key === "ordering")?.passed),
    checklistFoliation: readiness.every(foliationOk),
    checklistBoxFolder: readiness.every((r) => r.checks.find((c) => c.key === "labeling")?.passed),
    checklistInventory: readiness.every((r) => r.checks.find((c) => c.key === "fuid")?.passed),
    checklistApproval: false,
    allReady,
  };
}

export function GuidedTransferWizard({ canComplete }: { canComplete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<ExpedienteReadiness[]>([]);
  const [approval, setApproval] = useState(false);

  useEffect(() => {
    fetch("/api/v1/lifecycle?view=ready")
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.ready) setReadiness(j.data.ready);
      })
      .catch(() => {});
  }, []);

  const derived = useMemo(() => deriveChecks(readiness), [readiness]);
  const checks: Record<CheckKey, boolean> = {
    checklistRetentionMet: derived.checklistRetentionMet,
    checklistDocumentSelection: derived.checklistDocumentSelection,
    checklistChronological: derived.checklistChronological,
    checklistFoliation: derived.checklistFoliation,
    checklistBoxFolder: derived.checklistBoxFolder,
    checklistInventory: derived.checklistInventory,
    checklistApproval: approval,
  };

  const done = STEP_KEYS.filter((k) => checks[k]).length;
  const total = STEP_KEYS.length;
  const expedienteIds = readiness.map((r) => r.expedienteId);

  async function submitTransfer() {
    if (!derived.allReady || expedienteIds.length === 0) {
      toast.error("No hay expedientes listos para transferencia primaria");
      return;
    }
    if (!approval) {
      toast.error("Requiere aprobación del Archivo Central");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Transferencia primaria — ${expedienteIds.length} expediente(s)`,
          kind: "PRIMARY",
          fromPhase: "MANAGEMENT",
          toPhase: "CENTRAL",
          documentIds: [],
          expedienteIds,
          notes: "Transferencia primaria validada conforme TRD COOTRANSHUILA",
          checklistFoliation: true,
          checklistChronological: true,
          checklistInventory: true,
          checklistBoxFolder: true,
          checklistRetentionMet: true,
          checklistApproval: approval,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Error al crear transferencia");

      window.open(`/api/v1/lifecycle/${data.data.id}/inventory?format=xlsx`, "_blank");

      if (canComplete) {
        const doneRes = await fetch(`/api/v1/lifecycle/${data.data.id}/complete`, { method: "POST" });
        const doneData = await doneRes.json();
        if (!doneRes.ok || !doneData.success) {
          toast.warning(doneData.error || "Transferencia creada — pendiente aprobación");
        } else {
          toast.success("Transferencia completada — expedientes en Archivo Central");
        }
      } else {
        toast.success("Transferencia registrada — pendiente Archivo Central");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle>Transferencia primaria → Archivo Central</CardTitle>
          <p className="text-sm text-slate-600">
            {readiness.length} expediente(s) listo(s) · {done}/{total} validaciones
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <ol className="space-y-2 text-sm">
            {TRANSFER_GUIDED_STEPS.map((step, i) => {
              const key = STEP_KEYS[i];
              const checked = checks[key];
              const auto = key !== "checklistApproval";
              return (
                <li key={step.key} className="flex items-center gap-2">
                  {auto ? (
                    <span className={checked ? "text-emerald-700" : "text-amber-800"}>{checked ? "✓" : "○"}</span>
                  ) : (
                    <input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} />
                  )}
                  <span className={checked ? "text-emerald-800" : ""}>
                    Paso {i + 1}: {step.label}
                    {step.key === "checklistFoliation" && (
                      <span className="ml-1 text-xs text-slate-400">(digital + física trazada)</span>
                    )}
                    {auto && step.key !== "checklistFoliation" && (
                      <span className="ml-1 text-xs text-slate-400">(validación automática)</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {readiness.length > 0 ? (
            <ul className="rounded border border-slate-200 bg-white p-3 text-xs space-y-2">
              {readiness.map((r) => {
                const pending = r.checks.filter((c) => !c.passed);
                return (
                  <li key={r.expedienteId}>
                    <p className="font-mono font-medium text-slate-800">
                      {r.code} — {r.subject}
                    </p>
                    {pending.length > 0 && (
                      <ul className="mt-1 list-disc pl-4 text-amber-800">
                        {pending.map((c) => (
                          <li key={c.key}>
                            {c.label}
                            {c.detail ? ` (${c.detail})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-amber-800">
              Ningún expediente cumple todos los requisitos. Complete el proceso en cada expediente.
            </p>
          )}
          <Button className="w-full sm:w-auto" disabled={busy || !derived.allReady || !approval} onClick={submitTransfer}>
            {busy ? "Procesando…" : "Transferir a Archivo Central"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
