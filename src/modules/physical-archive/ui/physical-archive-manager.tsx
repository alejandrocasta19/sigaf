"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const LEVELS = [
  { value: "BUILDING", label: "Edificio" },
  { value: "FLOOR", label: "Piso" },
  { value: "ROOM", label: "Sala" },
  { value: "SHELF", label: "Estantería" },
  { value: "LEVEL", label: "Nivel" },
];

type Loc = { id: string; code: string; name: string; level: string; parentId?: string | null };
type Box = { id: string; code: string };
type Folder = { id: string; code: string; boxId?: string | null };
type Exp = { id: string; code: string; subject?: string | null; name: string };

export function PhysicalArchiveManager({
  locations,
  boxes,
  folders,
  expedientes,
}: {
  locations: Loc[];
  boxes: Box[];
  folders: Folder[];
  expedientes: Exp[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [locCode, setLocCode] = useState("");
  const [locName, setLocName] = useState("");
  const [locLevel, setLocLevel] = useState("BUILDING");
  const [locParent, setLocParent] = useState("");

  const [boxCode, setBoxCode] = useState("");
  const [boxCap, setBoxCap] = useState(20);
  const [boxLoc, setBoxLoc] = useState(locations[0]?.id ?? "");

  const [folderCode, setFolderCode] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderBox, setFolderBox] = useState(boxes[0]?.id ?? "");

  const [expId, setExpId] = useState(expedientes[0]?.id ?? "");
  const [assignBox, setAssignBox] = useState(boxes[0]?.id ?? "");
  const [assignFolder, setAssignFolder] = useState("");

  async function post(url: string, body: object) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Registrado");
      router.refresh();
      return json.data;
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
          <CardTitle>Ubicación (edificio → nivel)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Código</Label>
            <Input value={locCode} onChange={(e) => setLocCode(e.target.value)} placeholder="ED-01" />
          </div>
          <div>
            <Label>Nombre</Label>
            <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Sede principal" />
          </div>
          <div>
            <Label>Nivel</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={locLevel}
              onChange={(e) => setLocLevel(e.target.value)}
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Ubicación padre</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={locParent}
              onChange={(e) => setLocParent(e.target.value)}
            >
              <option value="">Ninguna (raíz)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
              ))}
            </select>
          </div>
          <Button
            className="sm:col-span-2"
            disabled={busy}
            onClick={() =>
              post("/api/v1/locations", {
                code: locCode,
                name: locName,
                level: locLevel,
                parentId: locParent || undefined,
              })
            }
          >
            Crear ubicación
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Caja de conservación</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Código (vacío = automático)</Label>
            <Input value={boxCode} onChange={(e) => setBoxCode(e.target.value)} placeholder="CAJ-0001" />
          </div>
          <div>
            <Label>Capacidad (carpetas)</Label>
            <Input type="number" min={1} value={boxCap} onChange={(e) => setBoxCap(Number(e.target.value) || 20)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Ubicación</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={boxLoc}
              onChange={(e) => setBoxLoc(e.target.value)}
            >
              <option value="">Sin ubicar</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
              ))}
            </select>
          </div>
          <Button
            className="sm:col-span-2"
            disabled={busy}
            onClick={() =>
              post("/api/v1/boxes", {
                code: boxCode || undefined,
                capacity: boxCap,
                locationId: boxLoc || undefined,
              })
            }
          >
            Crear caja
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Carpeta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Código (vacío = automático)</Label>
            <Input value={folderCode} onChange={(e) => setFolderCode(e.target.value)} placeholder="CAR-0001" />
          </div>
          <div>
            <Label>Nombre / asunto</Label>
            <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Prestación de servicios" />
          </div>
          <div className="sm:col-span-2">
            <Label>Caja</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={folderBox}
              onChange={(e) => setFolderBox(e.target.value)}
            >
              <option value="">Sin caja</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>{b.code}</option>
              ))}
            </select>
          </div>
          <Button
            className="sm:col-span-2"
            disabled={busy}
            onClick={() =>
              post("/api/v1/folders", {
                code: folderCode || undefined,
                name: folderName || undefined,
                boxId: folderBox || undefined,
              })
            }
          >
            Crear carpeta
          </Button>
        </CardContent>
      </Card>

      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle>Ubicar expediente en caja / carpeta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div>
            <Label>Expediente</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={expId}
              onChange={(e) => setExpId(e.target.value)}
            >
              {expedientes.map((e) => (
                <option key={e.id} value={e.id}>{e.code} — {e.subject ?? e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Caja</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={assignBox}
              onChange={(e) => setAssignBox(e.target.value)}
            >
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>{b.code}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Carpeta (opcional — se crea si falta)</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={assignFolder}
              onChange={(e) => setAssignFolder(e.target.value)}
            >
              <option value="">Nueva carpeta automática</option>
              {folders
                .filter((f) => !assignBox || f.boxId === assignBox || !f.boxId)
                .map((f) => (
                  <option key={f.id} value={f.id}>{f.code}</option>
                ))}
            </select>
          </div>
          <Button
            disabled={busy || !expId || !assignBox}
            onClick={() =>
              post("/api/v1/physical-archive/assign", {
                expedienteId: expId,
                boxId: assignBox,
                folderId: assignFolder || undefined,
              })
            }
          >
            Asignar ubicación física
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
