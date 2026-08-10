"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function CreateExpedienteForm({
  dependencies,
  defaultDependencyId,
}: {
  dependencies: { id: string; code: string; name: string }[];
  defaultDependencyId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dependencyId, setDependencyId] = useState(defaultDependencyId || dependencies[0]?.id || "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !dependencyId) {
      toast.error("Nombre y dependencia requeridos");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/expedientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          dependencyId,
          description: description.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Expediente creado");
      router.push(`/expedientes/${json.data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo expediente</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Dependencia</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={dependencyId}
              onChange={(e) => setDependencyId(e.target.value)}
            >
              {dependencies.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Descripción</Label>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Creando…" : "Crear expediente"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
