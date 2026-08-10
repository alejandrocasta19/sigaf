"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const JOBS = [
  { type: "retention.scan", label: "Escanear retención vencida" },
  { type: "disposal.candidates.notify", label: "Notificar candidatos eliminación" },
  { type: "loans.overdue.scan", label: "Marcar préstamos vencidos (24h)" },
  { type: "system.backup", label: "Ejecutar backup" },
] as const;

export function JobsRunnerPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(type: string) {
    setBusy(type);
    try {
      const res = await fetch("/api/v1/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success(`Job ${type} → ${json.data.status}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jobs automáticos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {JOBS.map((j) => (
          <Button
            key={j.type}
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() => run(j.type)}
          >
            {busy === j.type ? "Ejecutando…" : j.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
