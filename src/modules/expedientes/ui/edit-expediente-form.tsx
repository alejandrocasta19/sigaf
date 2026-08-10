"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const STATUSES = [
  "ACTIVE",
  "CLOSED",
  "ARCHIVED",
  "PENDING",
  "DELETED",
] as const;

export function EditExpedienteForm({
  id,
  name: initialName,
  description: initialDescription,
  status: initialStatus,
}: {
  id: string;
  name: string;
  description: string | null;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || "");
  const [status, setStatus] = useState(initialStatus);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/expedientes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Expediente actualizado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Estado</Label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Descripción</Label>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Button disabled={busy} onClick={save}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
