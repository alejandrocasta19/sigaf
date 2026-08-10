"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

type Candidate = {
  id: string;
  code: string;
  name: string;
  folioCount: number;
  retentionDueAt: string | null;
  dependency: { name: string };
  series: { name: string; code: string } | null;
};

export function DisposalCandidatesPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/v1/trd/disposal-candidates")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setItems(j.data);
      })
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createProcess() {
    if (selected.size === 0) {
      toast.error("Seleccione candidatos");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/trd/disposal-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_from_candidates",
          title: `Eliminación TRD — ${selected.size} documentos`,
          documentIds: [...selected],
          inventoryNote: "Candidatos con retención vencida y disposición ELIMINATION",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Proceso creado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Candidatos TRD ({items.length})</CardTitle>
        <div className="flex gap-2">
          <a href="/api/v1/trd/disposal-candidates?view=export">
            <Button size="sm" variant="outline" type="button">
              Excel
            </Button>
          </a>
          <Button size="sm" disabled={busy} onClick={createProcess}>
            Crear proceso con seleccionados
          </Button>
        </div>
      </CardHeader>
      <CardContent className="max-h-72 overflow-auto">
        <ul className="space-y-2 text-sm">
          {items.map((d) => (
            <li key={d.id} className="flex items-start gap-2 border-b border-slate-50 py-2">
              <input
                type="checkbox"
                checked={selected.has(d.id)}
                onChange={() => toggle(d.id)}
              />
              <div>
                <p className="font-medium">
                  {d.code} — {d.name}
                </p>
                <p className="text-xs text-slate-500">
                  {d.dependency.name} · {d.series?.code ?? "sin serie"} · vence{" "}
                  {d.retentionDueAt?.slice(0, 10) ?? "n/d"}
                </p>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-slate-500">No hay candidatos con retención vencida.</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

export function PublishInventoryButton({ processId }: { processId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action: "publish_inventory" | "complete_with_history") {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/trd/disposal-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, processId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success(action === "publish_inventory" ? "Inventario PDF publicado" : "Eliminación cerrada con historial");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("publish_inventory")}>
        Publicar inventario PDF
      </Button>
      <Button size="sm" disabled={busy} onClick={() => run("complete_with_history")}>
        Acta + historial
      </Button>
    </div>
  );
}
