"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { DOCUMENT_SUPPORTS, ELECTRONIC_FORMATS } from "@/shared/kernel/archival-process";
import { directUpload } from "@/shared/ui/direct-upload";

type Option = { id: string; name: string; code?: string; seriesId?: string; subject?: string };

export function SubmitDocumentForm({
  dependencyId,
  dependencyName,
  documentTypes,
  series,
  subseries,
  expedientes = [],
}: {
  dependencyId: string;
  dependencyName: string;
  documentTypes: Option[];
  series: Option[];
  subseries: Option[];
  expedientes?: Option[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expedienteId, setExpedienteId] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [subseriesId, setSubseriesId] = useState("");
  const [folioCount, setFolioCount] = useState(1);
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [support, setSupport] = useState("ELECTRONIC");
  const [electronicFormat, setElectronicFormat] = useState("PDF");
  const [observations, setObservations] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const filteredSubseries = useMemo(
    () => subseries.filter((s) => !seriesId || s.seriesId === seriesId),
    [subseries, seriesId]
  );

  const selectedExp = expedientes.find((e) => e.id === expedienteId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Indique el nombre del documento");
      return;
    }
    if (!expedienteId) {
      toast.error("Seleccione el expediente al que pertenece el documento");
      return;
    }
    if (support !== "PHYSICAL" && !file) {
      toast.error("Los documentos electrónicos requieren archivo adjunto");
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
          expedienteId,
          documentTypeId: documentTypeId || undefined,
          seriesId: seriesId || undefined,
          subseriesId: subseriesId || undefined,
          folioCount,
          documentDate,
          support,
          electronicFormat: support !== "PHYSICAL" ? electronicFormat : undefined,
          fileName: file?.name,
          observations: observations.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "No se pudo cargar el documento");

      const docId = json.data.id as string;
      if (file) {
        await directUpload(file, {
          purpose: "version",
          targetId: docId,
          extra: { changeNote: "Archivo inicial para revisión de dependencia" },
        });
      }

      toast.success("Documento vinculado al expediente · Pendiente de revisión");
      router.push(`/expedientes/${expedienteId}`);
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
        <p className="text-sm text-slate-500">Todo documento debe pertenecer a un expediente (un trámite = un expediente).</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="expediente">Expediente *</Label>
            <select
              id="expediente"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={expedienteId}
              onChange={(e) => setExpedienteId(e.target.value)}
              required
            >
              <option value="">Seleccione expediente…</option>
              {expedientes.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.code} — {ex.subject ?? ex.name}
                </option>
              ))}
            </select>
            {selectedExp && (
              <p className="mt-1 text-xs text-emerald-700">Serie TRD heredada del expediente</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="name">Nombre del documento</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Solicitud, Contrato, Acta…" />
          </div>

          <div>
            <Label htmlFor="docType">Tipología / tipo documental</Label>
            <select id="docType" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)}>
              <option value="">Seleccione…</option>
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="folios">Folios</Label>
            <Input id="folios" type="number" min={1} value={folioCount} onChange={(e) => setFolioCount(Number(e.target.value) || 1)} />
          </div>

          <div>
            <Label htmlFor="date">Fecha del documento</Label>
            <Input id="date" type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="support">Soporte</Label>
            <select id="support" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={support} onChange={(e) => setSupport(e.target.value)}>
              {DOCUMENT_SUPPORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {support !== "PHYSICAL" && (
            <div>
              <Label htmlFor="format">Formato electrónico</Label>
              <select id="format" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={electronicFormat} onChange={(e) => setElectronicFormat(e.target.value)}>
                {ELECTRONIC_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}

          {!expedienteId && (
            <>
              <div>
                <Label htmlFor="series">Serie documental</Label>
                <select id="series" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={seriesId} onChange={(e) => { setSeriesId(e.target.value); setSubseriesId(""); }}>
                  <option value="">Seleccione…</option>
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ""}{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="subseries">Subserie</Label>
                <select id="subseries" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={subseriesId} onChange={(e) => setSubseriesId(e.target.value)} disabled={!seriesId}>
                  <option value="">Seleccione…</option>
                  {filteredSubseries.map((s) => (
                    <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ""}{s.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <Label htmlFor="file">Archivo {support === "PHYSICAL" ? "(opcional)" : "*"}</Label>
            <Input id="file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx,.tiff" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required={support !== "PHYSICAL"} />
          </div>

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
