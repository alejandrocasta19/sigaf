"use client";

import { useMemo, useState } from "react";

function fmtDateDisplay(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO");
}

function fmtFolios(start?: number | null, end?: number | null) {
  if (start && end) return `${String(start).padStart(3, "0")} – ${String(end).padStart(3, "0")}`;
  return "—";
}

export function buildBoxLabelUrl(
  expedienteId: string,
  params: {
    boxCode: string;
    section: string;
    subsection: string;
    series: string;
    subseries: string;
    code: string;
    folderRange: string;
    dateStart: string;
    dateEnd: string;
    preview?: boolean;
  }
) {
  const qs = new URLSearchParams({
    type: "box",
    boxCode: params.boxCode,
    section: params.section,
    subsection: params.subsection,
    series: params.series,
    subseries: params.subseries,
    code: params.code,
    folderRange: params.folderRange,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
  });
  if (params.preview) qs.set("preview", "1");
  return `/api/v1/expedientes/${expedienteId}/labels?${qs}`;
}

export function LabelPreviewPanel({
  expedienteId,
  expedienteCode,
  organizationName,
  dependencyName,
  subsection,
  seriesName,
  subseriesName,
  folioStart,
  folioEnd,
  folderNumber,
  boxCode,
  dateStart,
  dateEnd,
}: {
  expedienteId: string;
  expedienteCode: string;
  organizationName: string;
  dependencyName: string;
  subsection?: string | null;
  seriesName?: string | null;
  subseriesName?: string | null;
  folioStart?: number | null;
  folioEnd?: number | null;
  folderNumber: string;
  boxCode: string;
  dateStart: string;
  dateEnd: string;
}) {
  const [labelType, setLabelType] = useState<"folder" | "box">("folder");

  const previewUrl = useMemo(() => {
    if (labelType === "folder") {
      return `/api/v1/expedientes/${expedienteId}/labels?type=folder&preview=1`;
    }
    return buildBoxLabelUrl(expedienteId, {
      boxCode: boxCode || "0001",
      section: dependencyName,
      subsection: subsection ?? dependencyName,
      series: seriesName ?? "",
      subseries: subseriesName ?? "",
      code: expedienteCode,
      folderRange: folderNumber || "01",
      dateStart,
      dateEnd,
      preview: true,
    });
  }, [
    labelType,
    expedienteId,
    boxCode,
    dependencyName,
    subsection,
    seriesName,
    subseriesName,
    expedienteCode,
    folderNumber,
    dateStart,
    dateEnd,
  ]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setLabelType("folder")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            labelType === "folder"
              ? "bg-emerald-700 text-white"
              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Carpeta (100×140 mm)
        </button>
        <button
          type="button"
          onClick={() => setLabelType("box")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            labelType === "box"
              ? "bg-emerald-700 text-white"
              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Caja (100×150 mm)
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-[10px] leading-relaxed">
          <div className="mb-2 rounded bg-[#00524a] px-2 py-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-white">
            {organizationName}
          </div>
          <p className="mb-2 text-center text-[8px] font-semibold text-emerald-800">
            {labelType === "folder" ? "ETIQUETA DE CARPETA" : `CAJA No. ${boxCode || "0001"}`}
          </p>
          <dl className="space-y-0.5">
            <div className="flex border-b border-slate-100 py-0.5">
              <dt className="w-24 shrink-0 font-bold">SECCIÓN:</dt>
              <dd>{dependencyName}</dd>
            </div>
            <div className="flex border-b border-slate-100 py-0.5">
              <dt className="w-24 shrink-0 font-bold">SERIE:</dt>
              <dd>{seriesName ?? "—"}</dd>
            </div>
            <div className="flex border-b border-slate-100 py-0.5">
              <dt className="w-24 shrink-0 font-bold">EXPEDIENTE:</dt>
              <dd className="font-mono">{expedienteCode}</dd>
            </div>
            {labelType === "folder" ? (
              <>
                <div className="flex border-b border-slate-100 py-0.5">
                  <dt className="w-24 shrink-0 font-bold">CARPETA:</dt>
                  <dd>{folderNumber || "01"}</dd>
                </div>
                <div className="flex border-b border-slate-100 py-0.5">
                  <dt className="w-24 shrink-0 font-bold">FOLIOS:</dt>
                  <dd>{fmtFolios(folioStart, folioEnd)}</dd>
                </div>
              </>
            ) : (
              <div className="flex border-b border-slate-100 py-0.5">
                <dt className="w-24 shrink-0 font-bold">CARPETAS:</dt>
                <dd>{folderNumber || "01"}</dd>
              </div>
            )}
            <div className="flex border-b border-slate-100 py-0.5">
              <dt className="w-24 shrink-0 font-bold">FECHAS:</dt>
              <dd>
                {fmtDateDisplay(dateStart)} – {fmtDateDisplay(dateEnd)}
              </dd>
            </div>
            {labelType === "folder" && (
              <div className="flex py-0.5">
                <dt className="w-24 shrink-0 font-bold">CAJA:</dt>
                <dd>{boxCode || "—"}</dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-center text-[7px] italic text-slate-400">
            Plantilla COOTRANSHUILA · SIGAF
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <iframe
            key={previewUrl}
            src={previewUrl}
            title="Vista previa etiqueta PDF"
            className="h-[280px] w-full"
          />
          <p className="border-t border-slate-200 px-2 py-1 text-center text-[10px] text-slate-500">
            Vista previa PDF — verifique antes de imprimir
          </p>
        </div>
      </div>
    </div>
  );
}
