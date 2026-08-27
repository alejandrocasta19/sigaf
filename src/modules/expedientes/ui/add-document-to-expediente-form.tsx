"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { DOCUMENT_SUPPORTS, ELECTRONIC_FORMATS } from "@/shared/kernel/archival-process";
import { directUpload } from "@/shared/ui/direct-upload";

type DocType = { id: string; name: string };

export function AddDocumentToExpedienteForm({
  expedienteId,
  expedienteCode,
  documentTypes,
}: {
  expedienteId: string;
  expedienteCode: string;
  documentTypes: DocType[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [folioCount, setFolioCount] = useState(1);
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [support, setSupport] = useState("PHYSICAL");
  const [electronicFormat, setElectronicFormat] = useState("PDF");
  const [file, setFile] = useState<File | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Indique el nombre del documento");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/expedientes/${expedienteId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          documentTypeId: documentTypeId || undefined,
          folioCount,
          documentDate,
          support,
          electronicFormat: support !== "PHYSICAL" ? electronicFormat : undefined,
          fileName: file?.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");

      const docId = json.data.id as string;
      if (file) {
        await directUpload(file, {
          purpose: "version",
          targetId: docId,
          extra: { changeNote: "Documento vinculado al expediente" },
        });
      }

      toast.success("Documento agregado al expediente");
      setName("");
      setFile(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-sky-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Agregar documento — {expedienteCode}</CardTitle>
        <p className="text-xs text-slate-500">Un trámite = un expediente. Cada documento hereda serie/subserie TRD.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nombre del documento</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Solicitud, Contrato, Acta…" />
          </div>
          <div>
            <Label>Tipo documental</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={documentTypeId}
              onChange={(e) => setDocumentTypeId(e.target.value)}
            >
              <option value="">Seleccione…</option>
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Fecha del documento</Label>
            <Input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
          </div>
          <div>
            <Label>Folios</Label>
            <Input type="number" min={1} value={folioCount} onChange={(e) => setFolioCount(Number(e.target.value) || 1)} />
          </div>
          <div>
            <Label>Soporte</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={support}
              onChange={(e) => setSupport(e.target.value)}
            >
              {DOCUMENT_SUPPORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          {support !== "PHYSICAL" && (
            <div>
              <Label>Formato electrónico</Label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={electronicFormat}
                onChange={(e) => setElectronicFormat(e.target.value)}
              >
                {ELECTRONIC_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <Label>Archivo digital (opcional)</Label>
            <Input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx,.tiff" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button type="submit" disabled={busy} className="sm:col-span-2">
            {busy ? "Agregando…" : "Agregar al expediente"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
