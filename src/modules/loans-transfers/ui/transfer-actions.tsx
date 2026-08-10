"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import type { ArchivalPhase } from "@prisma/client";

export function TransferActions({
  phase,
  documentIds,
  expedienteIds,
  canComplete,
}: {
  phase: ArchivalPhase;
  documentIds: string[];
  expedienteIds: string[];
  canComplete: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [foliation, setFoliation] = useState(false);
  const [chrono, setChrono] = useState(false);
  const [inventory, setInventory] = useState(false);
  const [boxFolder, setBoxFolder] = useState(false);

  const next =
    phase === "MANAGEMENT"
      ? { to: "CENTRAL" as const, kind: "PRIMARY" as const, label: "Transferir a Archivo Central (primaria)" }
      : phase === "CENTRAL"
        ? {
            to: "HISTORICAL" as const,
            kind: "SECONDARY" as const,
            label: "Transferir a Archivo Histórico (secundaria)",
          }
        : null;

  if (!next) {
    return (
      <p className="text-sm text-slate-500">
        Los documentos en Archivo Histórico están de conservación permanente (Ley 594 art. 23 lit. c).
      </p>
    );
  }

  async function requestTransfer() {
    if (!next) return;
    if (documentIds.length + expedienteIds.length === 0) {
      toast.error("Seleccione documentos o expedientes");
      return;
    }
    if (!foliation || !chrono || !inventory || !boxFolder) {
      toast.error("Complete el checklist obligatorio antes de transferir");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Transferencia ${phase} → ${next.to}`,
          kind: next.kind,
          fromPhase: phase,
          toPhase: next.to,
          documentIds,
          expedienteIds,
          notes: "Conforme a TRD / Ley 594 de 2000",
          checklistFoliation: foliation,
          checklistChronological: chrono,
          checklistInventory: inventory,
          checklistBoxFolder: boxFolder,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Error al crear transferencia");
        return;
      }

      // Descargar inventario
      window.open(`/api/v1/lifecycle/${data.data.id}/inventory?format=xlsx`, "_blank");

      if (canComplete) {
        const done = await fetch(`/api/v1/lifecycle/${data.data.id}/complete`, {
          method: "POST",
        });
        const doneData = await done.json();
        if (!done.ok || !doneData.success) {
          toast.warning(doneData.error || "Transferencia creada pendiente de aprobación");
        } else {
          toast.success("Transferencia completada — fase actualizada");
        }
      } else {
        toast.success("Transferencia solicitada (pendiente de Archivo)");
      }
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <p className="text-sm font-medium text-amber-950">
        Checklist obligatorio (foliación, orden, inventario, caja/carpeta)
      </p>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {[
          ["Foliación verificada", foliation, setFoliation],
          ["Orden cronológico / original", chrono, setChrono],
          ["Inventario elaborado", inventory, setInventory],
          ["Caja y carpeta asignadas", boxFolder, setBoxFolder],
        ].map(([label, checked, set]) => (
          <label key={String(label)} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={checked as boolean}
              onChange={(e) => (set as (v: boolean) => void)(e.target.checked)}
            />
            {label as string}
          </label>
        ))}
      </div>
      <Button onClick={requestTransfer} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {next.label}
      </Button>
    </div>
  );
}

export function CompleteTransferButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function complete() {
    if (!confirm("¿Completar transferencia y mover ítems a la fase destino?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/lifecycle/${id}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "No se pudo completar");
        return;
      }
      toast.success("Transferencia completada");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <a href={`/api/v1/lifecycle/${id}/inventory?format=xlsx`}>
        <Button size="sm" variant="outline" type="button">
          Inventario
        </Button>
      </a>
      <Button size="sm" variant="outline" onClick={complete} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Completar
      </Button>
    </div>
  );
}
