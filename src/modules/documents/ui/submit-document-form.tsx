"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

type Option = { id: string; name: string; code?: string; seriesId?: string };

export function SubmitDocumentForm({
  dependencyId,
  dependencyName,
  documentTypes,
  series,
  subseries,
}: {
  dependencyId: string;
  dependencyName: string;
  documentTypes: Option[];
  series: Option[];
  subseries: Option[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [subseriesId, setSubseriesId] = useState("");
  const [folioCount, setFolioCount] = useState(1);
  const [observations, setObservations] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const filteredSubseries = useMemo(
    () => subseries.filter((s) => !seriesId || s.seriesId === seriesId),
    [subseries, seriesId]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Indique el nombre del documento");
      return;
    }
    if (!file) {
      toast.error("Adjunte el archivo PDF o documento digital para revisión");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/documents/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          name: name.trim(),
          description: description.trim() || undefined,
          dependencyId,
          documentTypeId: documentTypeId || undefined,
          seriesId: seriesId || undefined,
          subseriesId: subseriesId || undefined,
          folioCount,
          observations: observations.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "No se pudo cargar el documento");

      const docId = json.data.id as string;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("changeNote", "Archivo inicial para revisión de dependencia");
      const up = await fetch(`/api/v1/documents/${docId}/versions`, {
        method: "POST",
        body: fd,
      });
      const upJson = await up.json();
      if (!up.ok || !upJson.success) {
        toast.warning(
          "Documento creado, pero el archivo no se pudo adjuntar. Cárguelo desde el detalle."
        );
        router.push(`/documents/${docId}`);
        return;
      }

      toast.success("Documento y archivo enviados · Pendiente de Revisión");
      router.push(`/documents/${docId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carga documental — {dependencyName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Nombre del documento</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ej. Memorando solicitud de información"
            />
          </div>

          <div>
            <Label htmlFor="docType">Tipología / tipo documental</Label>
            <select
              id="docType"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={documentTypeId}
              onChange={(e) => setDocumentTypeId(e.target.value)}
            >
              <option value="">Seleccione…</option>
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="folios">Folios</Label>
            <Input
              id="folios"
              type="number"
              min={1}
              value={folioCount}
              onChange={(e) => setFolioCount(Number(e.target.value) || 1)}
            />
          </div>

          <div>
            <Label htmlFor="series">Serie documental</Label>
            <select
              id="series"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={seriesId}
              onChange={(e) => {
                setSeriesId(e.target.value);
                setSubseriesId("");
              }}
            >
              <option value="">Seleccione…</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} — ` : ""}
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="subseries">Subserie documental</Label>
            <select
              id="subseries"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={subseriesId}
              onChange={(e) => setSubseriesId(e.target.value)}
              disabled={!seriesId}
            >
              <option value="">Seleccione…</option>
              {filteredSubseries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} — ` : ""}
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="obs">Observaciones</Label>
            <textarea
              id="obs"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="file">Archivo PDF o documento digital</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            {file && (
              <p className="mt-1 text-xs text-slate-500">
                Seleccionado: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <p className="sm:col-span-2 text-xs text-slate-500">
            Al guardar, el documento quedará en estado <strong>Pendiente de Revisión</strong> y
            el Jefe de Dependencia podrá visualizar y descargar el archivo para rectificar la
            información antes de aprobar o rechazar.
          </p>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700">
              {saving ? "Enviando…" : "Cargar y enviar a revisión"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
