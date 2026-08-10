"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import type { DisposalStatus } from "@prisma/client";

const NEXT: Partial<Record<DisposalStatus, { action: string; label: string }>> = {
  DRAFT: { action: "publish", label: "Publicar inventario" },
  INVENTORY_PUBLISHED: { action: "observations", label: "Registrar observaciones" },
  OBSERVATIONS: { action: "technical", label: "Concepto técnico" },
  TECHNICAL_REVIEW: { action: "acta", label: "Preparar acta" },
  ACTA_PENDING: { action: "approve", label: "Aprobar eliminación" },
  APPROVED: { action: "complete", label: "Ejecutar y cerrar" },
};

export function DisposalActions({
  processId,
  status,
  compact = false,
}: {
  processId?: string;
  status?: DisposalStatus;
  compact?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) {
      toast.error("Indique el título");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/trd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: title.trim(),
          inventoryNote: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Proceso de eliminación creado");
      setTitle("");
      setNote("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function advance(action: string) {
    if (!processId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/trd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: processId,
          notes: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Proceso actualizado");
      setNote("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (compact && processId && status) {
    const next = NEXT[status];
    if (!next) return null;
    return (
      <div className="space-y-2">
        <textarea
          className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
          rows={2}
          placeholder="Notas / concepto / observaciones"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          <Button size="sm" disabled={busy} onClick={() => advance(next.action)}>
            {next.label}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => advance("cancel")}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar proceso de eliminación</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Eliminación series contables 2015 retenidas"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="inv">Nota de inventario</Label>
          <textarea
            id="inv"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <Button disabled={busy} onClick={create} className="bg-emerald-600 hover:bg-emerald-700">
          Crear borrador
        </Button>
      </CardContent>
    </Card>
  );
}
