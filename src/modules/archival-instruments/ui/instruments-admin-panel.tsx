"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const TYPES = ["TVD", "CCD", "PGD", "POLICY", "TRD"] as const;

export function InstrumentsAdminPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]>("TVD");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0");
  const [uploadId, setUploadId] = useState("");

  async function create() {
    if (!name.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, version }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Instrumento creado");
      setUploadId(json.data.id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | null) {
    if (!file || !uploadId) {
      toast.error("Indique ID de instrumento y archivo");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("id", uploadId);
      fd.append("file", file);
      const res = await fetch("/api/v1/instruments", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("PDF/archivo adjunto");
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
        <CardTitle>Gestionar TVD / CCD / PGD</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Tipo</Label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Versión</Label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button disabled={busy} onClick={create}>
          Crear instrumento
        </Button>
        <div className="sm:col-span-2 border-t pt-3">
          <Label>Subir PDF (ID instrumento)</Label>
          <Input
            className="mb-2"
            value={uploadId}
            onChange={(e) => setUploadId(e.target.value)}
            placeholder="ID tras crear, o pegue el id de la tarjeta"
          />
          <Input
            type="file"
            accept=".pdf"
            disabled={busy}
            onChange={(e) => upload(e.target.files?.[0] ?? null)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
