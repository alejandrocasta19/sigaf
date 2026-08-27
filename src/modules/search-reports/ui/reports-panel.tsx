"use client";

import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { enqueueAndDownloadReport, directUpload, pollJob } from "@/shared/ui/direct-upload";

const REPORTS = [
  {
    type: "documents" as const,
    title: "Inventario de documentos",
    desc: "Listado completo por dependencia",
    icon: FileText,
  },
  {
    type: "expedientes" as const,
    title: "Expedientes activos",
    desc: "Reporte de expedientes abiertos",
    icon: FileSpreadsheet,
  },
  {
    type: "loans" as const,
    title: "Préstamos pendientes",
    desc: "Préstamos por vencer o vencidos",
    icon: Download,
  },
  {
    type: "audit" as const,
    title: "Auditoría mensual",
    desc: "Eventos del último mes",
    icon: FileText,
  },
];

export function ReportsPanel({ canImport }: { canImport: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    errors: string[];
  } | null>(null);

  async function onExport(type: string, format: "xlsx" | "pdf" | "csv") {
    const key = `${type}-${format}`;
    setBusy(key);
    try {
      await enqueueAndDownloadReport(type, format);
      toast.success(`Reporte ${format.toUpperCase()} descargado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function onImport(file: File | null) {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await directUpload(file, { purpose: "import" });
      const jobId = (result as { jobId?: string }).jobId;
      if (jobId) {
        const job = await pollJob(jobId);
        const data = job.result as { created?: number; errors?: string[] };
        setImportResult({ created: data.created ?? 0, errors: data.errors ?? [] });
        toast.success(`${data.created ?? 0} documento(s) importados`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.type}>
            <CardHeader className="flex-row items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <r.icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{r.title}</CardTitle>
                <p className="mt-1 text-xs text-slate-500">{r.desc}</p>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(["xlsx", "pdf", "csv"] as const).map((fmt) => (
                <Button
                  key={fmt}
                  variant="outline"
                  size="sm"
                  disabled={busy === `${r.type}-${fmt}`}
                  onClick={() => onExport(r.type, fmt)}
                >
                  {busy === `${r.type}-${fmt}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {fmt.toUpperCase()}
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {canImport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-emerald-600" />
              Importación masiva de documentos (Excel)
            </CardTitle>
            <p className="text-xs text-slate-500">
              Usa la plantilla con columnas Nombre y Dependencia (opcional: Código, Folios,
              Observaciones).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = "/api/v1/documents/import";
                }}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Descargar plantilla
              </Button>
              <label className="inline-flex cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => onImport(e.target.files?.[0] ?? null)}
                />
                <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Subir Excel
                </span>
              </label>
            </div>
            {importResult && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-medium text-emerald-700">
                  Creados: {importResult.created}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-red-600">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
