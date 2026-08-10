"use client";

import { useMemo, useState } from "react";
import { Download, Eye, FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import type { PreviewFile } from "./build-preview-files";

export type { PreviewFile } from "./build-preview-files";
export { buildPreviewFiles } from "./build-preview-files";

function isPreviewable(file: PreviewFile) {
  const name = `${file.label} ${file.filePath ?? ""} ${file.mimeHint ?? ""}`.toLowerCase();
  return (
    name.includes("pdf") ||
    name.includes("image/") ||
    /\.(pdf|png|jpe?g|gif|webp)$/i.test(name)
  );
}

function fileUrl(file: PreviewFile, disposition: "inline" | "attachment") {
  return `/api/v1/files?type=${file.kind}&id=${file.id}&disposition=${disposition}`;
}

export function DocumentFileViewer({
  files,
  title = "Archivo del documento",
  compact = false,
}: {
  files: PreviewFile[];
  title?: string;
  compact?: boolean;
}) {
  const available = useMemo(
    () => files.filter((f) => f.id && (f.filePath || f.kind !== "document")),
    [files]
  );
  const primary = available[0] ?? null;
  const [active, setActive] = useState<PreviewFile | null>(null);

  const previewTarget = active ?? (primary && isPreviewable(primary) ? primary : null);

  if (available.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
        Aún no hay archivo digital cargado. Pida al funcionario adjuntar el PDF o una versión
        del documento antes de aprobar.
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-600">Archivos para revisar</p>
        <div className="flex flex-wrap gap-2">
          {available.map((f) => (
            <div key={`${f.kind}-${f.id}`} className="flex items-center gap-1">
              {isPreviewable(f) && (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setActive(f)}
                >
                  <Eye className="h-3.5 w-3.5" /> Ver
                </Button>
              )}
              <a href={fileUrl(f, "attachment")}>
                <Button size="sm" variant="secondary" type="button">
                  <Download className="h-3.5 w-3.5" /> {f.label}
                </Button>
              </a>
            </div>
          ))}
        </div>
        {active && isPreviewable(active) && (
          <PreviewFrame file={active} onClose={() => setActive(null)} />
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-blue-600" />
          {title}
        </CardTitle>
        {primary && (
          <div className="flex flex-wrap gap-2">
            {isPreviewable(primary) && (
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setActive(primary)}
              >
                <Eye className="h-3.5 w-3.5" /> Vista previa
              </Button>
            )}
            <a href={fileUrl(primary, "attachment")}>
              <Button size="sm" type="button">
                <Download className="h-3.5 w-3.5" /> Descargar
              </Button>
            </a>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {available.map((f) => (
            <li
              key={`${f.kind}-${f.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                {f.kind === "attachment" ? (
                  <Paperclip className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                )}
                {f.label}
              </span>
              <div className="flex gap-1">
                {isPreviewable(f) && (
                  <Button size="sm" variant="outline" type="button" onClick={() => setActive(f)}>
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </Button>
                )}
                <a href={fileUrl(f, "attachment")}>
                  <Button size="sm" variant="secondary" type="button">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </li>
          ))}
        </ul>

        {previewTarget && isPreviewable(previewTarget) && (
          <PreviewFrame
            file={previewTarget}
            onClose={active ? () => setActive(null) : undefined}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PreviewFrame({
  file,
  onClose,
}: {
  file: PreviewFile;
  onClose?: () => void;
}) {
  const url = fileUrl(file, "inline");
  const image = /image\/|\.(png|jpe?g|gif|webp)$/i.test(
    `${file.mimeHint ?? ""} ${file.label} ${file.filePath ?? ""}`
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <p className="truncate text-xs font-medium text-slate-700">{file.label}</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar vista previa"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.label} className="max-h-[70vh] w-full object-contain p-2" />
      ) : (
        <iframe
          title={`Vista previa ${file.label}`}
          src={url}
          className="h-[70vh] w-full bg-white"
        />
      )}
    </div>
  );
}
