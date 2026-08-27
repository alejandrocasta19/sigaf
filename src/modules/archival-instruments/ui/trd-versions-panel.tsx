"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";

type Version = {
  id: string;
  version: string;
  notes: string | null;
  seriesCount: number;
  createdAt: string;
};

type ActiveTrd = {
  name: string;
  version: string;
  lastUpdated: string | Date;
  approvedAt: string | Date | null;
} | null;

export function TrdVersionsPanel({
  activeTrd,
  canAdmin,
}: {
  activeTrd: ActiveTrd;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const [versions, setVersions] = useState<Version[]>([]);
  const [busy, setBusy] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/v1/trd/manage?view=versions")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setVersions(j.data);
      })
      .catch(() => {});
  }, []);

  async function snapshot() {
    if (!newVersion.trim()) {
      toast.error("Indique número de versión");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/trd/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snapshot", version: newVersion.trim(), notes: notes.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success(`Versión ${newVersion} registrada`);
      setNewVersion("");
      setNotes("");
      router.refresh();
      const r2 = await fetch("/api/v1/trd/manage?view=versions");
      const j2 = await r2.json();
      if (j2.data) setVersions(j2.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Versiones TRD</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeTrd && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Vigente</Badge>
              <span className="font-semibold">v{activeTrd.version}</span>
            </div>
            <p className="mt-1 text-slate-700">{activeTrd.name}</p>
            <p className="text-xs text-slate-500">
              Aprobación: {activeTrd.approvedAt ? formatDate(activeTrd.approvedAt) : "—"} · Última
              actualización: {formatDate(activeTrd.lastUpdated)}
            </p>
          </div>
        )}

        {versions.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {versions
              .slice()
              .reverse()
              .map((v, i, arr) => (
                <span key={v.id} className="flex items-center gap-1">
                  v{v.version}
                  {i < arr.length - 1 && <span className="text-slate-300">─────</span>}
                </span>
              ))}
          </div>
        )}

        <ul className="space-y-2 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex justify-between border-b border-slate-50 py-2">
              <span>
                <span className="font-mono font-medium">v{v.version}</span>
                {v.notes && <span className="ml-2 text-slate-500">{v.notes}</span>}
              </span>
              <span className="text-xs text-slate-400">
                {v.seriesCount} series · {formatDate(v.createdAt)}
              </span>
            </li>
          ))}
        </ul>

        {canAdmin && (
          <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div>
              <Label>Nueva versión</Label>
              <Input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="3.1" />
            </div>
            <div>
              <Label>Notas de modificación</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reorganización dependencias" />
            </div>
            <Button disabled={busy} onClick={snapshot}>
              Crear nueva versión (snapshot)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
