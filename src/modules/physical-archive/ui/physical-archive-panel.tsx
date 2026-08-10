"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function PhysicalArchivePanel({
  boxes,
  folders,
}: {
  boxes: { id: string; code: string }[];
  folders: { id: string; code: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [boxId, setBoxId] = useState(boxes[0]?.id ?? "");
  const [folderId, setFolderId] = useState(folders[0]?.id ?? "");
  const [title, setTitle] = useState("Inventario físico de depósito");
  const [result, setResult] = useState<string | null>(null);

  async function checkProvenance() {
    if (!boxId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/physical-inventories?view=provenance&boxId=${boxId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setResult(json.data.message);
      if (json.data.ok) toast.success(json.data.message);
      else toast.warning(json.data.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function checkOrder() {
    if (!folderId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/physical-inventories?view=order&folderId=${folderId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setResult(json.data.message);
      if (json.data.ok) toast.success(json.data.message);
      else toast.warning(json.data.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function createInventory() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/physical-inventories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, notes: "Principio de procedencia y orden original" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success(`Inventario ${json.data.code} generado (Excel + acta PDF)`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Validaciones archivísticas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Caja (procedencia)</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
            >
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
            <Button className="mt-2" size="sm" variant="outline" disabled={busy} onClick={checkProvenance}>
              Validar procedencia
            </Button>
          </div>
          <div>
            <Label>Carpeta (orden original)</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                </option>
              ))}
            </select>
            <Button className="mt-2" size="sm" variant="outline" disabled={busy} onClick={checkOrder}>
              Validar orden original
            </Button>
          </div>
          {result && <p className="text-sm text-slate-600">{result}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventario físico formal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Título del acta</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Button disabled={busy} onClick={createInventory}>
            Generar inventario (Excel + PDF)
          </Button>
          <p className="text-xs text-slate-500">
            Jerarquía: Edificio → Piso → Sala → Estantería → Nivel
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
