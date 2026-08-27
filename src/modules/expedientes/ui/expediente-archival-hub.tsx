"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ARCHIVAL_PROCESS_STEPS,
  RETENTION_START_EVENTS,
  processStepsProgress,
  type ProcessStepsState,
} from "@/shared/kernel/archival-process";
import { finalDispositionLabel } from "@/shared/kernel/archival-process";
import { AddDocumentToExpedienteForm } from "./add-document-to-expediente-form";
import { LabelPreviewPanel, buildBoxLabelUrl } from "./label-preview-panel";
import type { ExpedienteReadiness } from "@/shared/kernel/expediente-cycle";

type Doc = {
  id: string;
  code: string;
  name: string;
  folioCount: number;
  documentDate: string | Date | null;
  sortOrder: number;
  support?: string;
  electronicFormat?: string | null;
};

type ExpedienteData = {
  id: string;
  code: string;
  name: string;
  status?: string;
  subject?: string | null;
  subsection?: string | null;
  expedienteType?: string | null;
  year?: number | null;
  foliationVerified: boolean;
  physicalFoliationDone?: boolean;
  foliationMethod?: string | null;
  foliationBy?: string | null;
  foliationAt?: string | Date | null;
  chronologicalOrder: boolean;
  folderNumber?: string | null;
  boxCode?: string | null;
  folioStart?: number | null;
  folioEnd?: number | null;
  dateStart?: string | Date | null;
  dateEnd?: string | Date | null;
  appliedRetentionMgmt?: number | null;
  appliedRetentionCentral?: number | null;
  appliedFinalDisposition?: string | null;
  retentionStartEvent?: string | null;
  retentionStartDate?: string | Date | null;
  retentionDueAt?: string | Date | null;
  organization?: { name: string } | null;
  dependency: { code: string; name: string };
  series?: { code: string; name: string } | null;
  subseries?: { code: string; name: string } | null;
  documents: Doc[];
  processSteps: ProcessStepsState;
  version?: number;
};

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO");
}

export function ExpedienteArchivalHub({
  expediente,
  canEdit,
  documentTypes = [],
  transferReadiness,
}: {
  expediente: ExpedienteData;
  canEdit: boolean;
  documentTypes?: { id: string; name: string }[];
  transferReadiness?: ExpedienteReadiness | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState(expediente.documents);
  const [chronological, setChronological] = useState(expediente.chronologicalOrder);
  const [foliationVerified, setFoliationVerified] = useState(expediente.foliationVerified);
  const [physicalFoliationDone, setPhysicalFoliationDone] = useState(
    expediente.physicalFoliationDone ?? false
  );
  const [foliationMethod, setFoliationMethod] = useState(
    expediente.foliationMethod ?? "MANUAL_PENCIL"
  );
  const [foliationBy, setFoliationBy] = useState(expediente.foliationBy ?? "");
  const [foliationAt, setFoliationAt] = useState(
    expediente.foliationAt
      ? new Date(expediente.foliationAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [retentionEvent, setRetentionEvent] = useState(expediente.retentionStartEvent ?? "TRAMITE_END");
  const [retentionDate, setRetentionDate] = useState(
    expediente.retentionStartDate
      ? new Date(expediente.retentionStartDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [folderNumber, setFolderNumber] = useState(expediente.folderNumber ?? "01");
  const [boxCode, setBoxCode] = useState(expediente.boxCode ?? "");
  const [dateStart, setDateStart] = useState(
    expediente.dateStart ? new Date(expediente.dateStart).toISOString().slice(0, 10) : ""
  );
  const [dateEnd, setDateEnd] = useState(
    expediente.dateEnd ? new Date(expediente.dateEnd).toISOString().slice(0, 10) : ""
  );

  const progress = processStepsProgress(expediente.processSteps);

  const hierarchy = useMemo(() => {
    const lines: { level: number; label: string }[] = [
      { level: 0, label: expediente.organization?.name ?? "Fondo" },
      { level: 1, label: `${expediente.dependency.name} (Sección ${expediente.dependency.code})` },
    ];
    if (expediente.subsection) lines.push({ level: 2, label: `Subsección: ${expediente.subsection}` });
    if (expediente.series) lines.push({ level: 3, label: `Serie: ${expediente.series.name}` });
    if (expediente.subseries) lines.push({ level: 4, label: `Subserie: ${expediente.subseries.name}` });
    lines.push({ level: 5, label: `Expediente: ${expediente.code}` });
    for (const d of docs) lines.push({ level: 6, label: d.name || d.code });
    return lines;
  }, [expediente, docs]);

  const folioAssignments = useMemo(() => {
    let folio = 1;
    return docs.map((d) => {
      const start = folio;
      folio += d.folioCount || 1;
      return { documentId: d.id, name: d.name, folioStart: start, folioCount: d.folioCount || 1 };
    });
  }, [docs]);

  async function patchArchival(body: object) {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/expedientes/${expediente.id}/archival`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, version: expediente.version }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Actualizado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function moveDoc(index: number, dir: -1 | 1) {
    const next = [...docs];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDocs(next);
  }

  async function saveOrder() {
    await patchArchival({
      action: "reorder",
      documentIds: docs.map((d) => d.id),
    });
  }

  async function validateFoliation() {
    if (foliationVerified && physicalFoliationDone && !foliationBy.trim()) {
      toast.error("Indique el responsable de la foliación física");
      return;
    }
    await patchArchival({
      action: "foliation",
      assignments: folioAssignments.map((a) => ({
        documentId: a.documentId,
        folioStart: a.folioStart,
        folioCount: a.folioCount,
      })),
      chronologicalOrder: chronological,
      foliationVerified,
      physicalFoliationDone,
      foliationMethod: physicalFoliationDone ? foliationMethod : undefined,
      foliationBy: physicalFoliationDone ? foliationBy.trim() : undefined,
      foliationAt: physicalFoliationDone ? foliationAt : undefined,
    });
  }

  async function saveRetention() {
    await patchArchival({
      action: "retention",
      retentionStartEvent: retentionEvent,
      retentionStartDate: retentionDate,
    });
  }

  async function saveLabels() {
    await patchArchival({
      action: "labels",
      folderNumber,
      boxCode: boxCode || undefined,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
    });
  }

  async function closeExpediente() {
    if (!confirm("¿Cerrar expediente e iniciar cómputo de retención?")) return;
    await patchArchival({ action: "close" });
  }

  async function createFuidInventory() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/inventories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `FUID ${expediente.code}`,
          transferCode: `TR-${expediente.code}`,
          expedienteIds: [expediente.id],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success(`Inventario ${json.data.code} creado`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clasificación jerárquica</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-700 sm:text-xs">
          {hierarchy.map((line, i) => (
            <div key={i} className="whitespace-nowrap" style={{ paddingLeft: `${Math.min(line.level, 5) * 10}px` }}>
              {line.level > 0 ? "└── " : ""}
              {line.label}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Proceso documental — {progress.percent}% completado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <ol className="space-y-1 text-sm">
            {ARCHIVAL_PROCESS_STEPS.map((s) => {
              const done = expediente.processSteps[s.key];
              return (
                <li key={s.key} className="flex items-center gap-2">
                  <span>{done ? "✓" : "○"}</span>
                  <span className={done ? "text-emerald-800" : "text-slate-500"}>
                    {s.order}. {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {canEdit && expediente.status !== "CLOSED" && (
        <AddDocumentToExpedienteForm
          expedienteId={expediente.id}
          expedienteCode={expediente.code}
          documentTypes={documentTypes}
        />
      )}

      {transferReadiness && (
        <Card className={transferReadiness.ready ? "border-emerald-300 bg-emerald-50/40" : "border-amber-300 bg-amber-50/40"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {transferReadiness.ready ? "✓ Listo para transferencia primaria" : "Pendiente para transferencia"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {transferReadiness.checks.map((c) => (
                <li key={c.key} className={c.passed ? "text-emerald-800" : "text-amber-900"}>
                  {c.passed ? "✓" : "○"} {c.label}
                  {c.detail && <span className="ml-1 text-xs text-slate-500">({c.detail})</span>}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {expediente.status !== "CLOSED" && (
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={closeExpediente}>
                    Cerrar expediente
                  </Button>
                )}
                <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={createFuidInventory}>
                  Generar inventario FUID
                </Button>
                {transferReadiness.ready && (
                  <Link href="/transfers" className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800 sm:w-auto sm:py-1.5">
                    Ir a transferencia → Archivo Central
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Orden documental</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {docs.map((d, i) => (
                <li key={d.id} className="flex flex-col gap-1 rounded border border-slate-100 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <span className="min-w-0 break-words text-sm">
                    {String(i + 1).padStart(3, "0")} {d.name}{" "}
                    <span className="text-slate-400">{fmtDate(d.documentDate)}</span>
                  </span>
                  {canEdit && (
                    <span className="flex shrink-0 gap-2 self-end sm:self-auto">
                      <button type="button" className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50" onClick={() => moveDoc(i, -1)}>
                        ↑
                      </button>
                      <button type="button" className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50" onClick={() => moveDoc(i, 1)}>
                        ↓
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {canEdit && docs.length > 1 && (
              <Button size="sm" className="mt-3" variant="outline" disabled={busy} onClick={saveOrder}>
                Guardar orden (con auditoría)
              </Button>
            )}
            <p className="mt-2 text-xs text-slate-500">↑ Orden cronológico original</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Foliación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {folioAssignments.map((a) => (
              <div key={a.documentId} className="flex justify-between border-b border-slate-50 py-1">
                <span>{a.name}</span>
                <span className="font-mono">
                  Folio {String(a.folioStart).padStart(3, "0")}
                  {a.folioCount > 1 ? `–${String(a.folioStart + a.folioCount - 1).padStart(3, "0")}` : ""}
                </span>
              </div>
            ))}
            {canEdit && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={chronological}
                    onChange={(e) => setChronological(e.target.checked)}
                  />
                  Orden cronológico
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={foliationVerified}
                    onChange={(e) => setFoliationVerified(e.target.checked)}
                  />
                  Foliación verificada (digital)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={physicalFoliationDone}
                    onChange={(e) => setPhysicalFoliationDone(e.target.checked)}
                  />
                  Foliación física realizada
                </label>
                {physicalFoliationDone && (
                  <div className="space-y-2 rounded border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-600">Trazabilidad foliación física</p>
                    <div className="space-y-1 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="foliationMethod"
                          checked={foliationMethod === "MANUAL_PENCIL"}
                          onChange={() => setFoliationMethod("MANUAL_PENCIL")}
                        />
                        Manual / lápiz
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="foliationMethod"
                          checked={foliationMethod === "OTHER"}
                          onChange={() => setFoliationMethod("OTHER")}
                        />
                        Otro método
                      </label>
                    </div>
                    <div>
                      <Label>Responsable</Label>
                      <Input
                        value={foliationBy}
                        onChange={(e) => setFoliationBy(e.target.value)}
                        placeholder="Nombre del funcionario"
                      />
                    </div>
                    <div>
                      <Label>Fecha</Label>
                      <Input
                        type="date"
                        value={foliationAt}
                        onChange={(e) => setFoliationAt(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <Button size="sm" disabled={busy} onClick={validateFoliation}>
                  Validar foliación
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inicio de retención (TRD)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {canEdit ? (
              <>
                <div className="space-y-1">
                  {RETENTION_START_EVENTS.map((ev) => (
                    <label key={ev.value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="retentionEvent"
                        value={ev.value}
                        checked={retentionEvent === ev.value}
                        onChange={() => setRetentionEvent(ev.value)}
                      />
                      {ev.label}
                    </label>
                  ))}
                </div>
                <div>
                  <Label>Fecha de inicio</Label>
                  <Input type="date" value={retentionDate} onChange={(e) => setRetentionDate(e.target.value)} />
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={saveRetention}>
                  Actualizar retención
                </Button>
              </>
            ) : null}
            <dl className="grid gap-1 pt-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Gestión</dt>
                <dd>{expediente.appliedRetentionMgmt ?? "—"} años</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Central</dt>
                <dd>{expediente.appliedRetentionCentral ?? "—"} años</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Disposición</dt>
                <dd>
                  {expediente.appliedFinalDisposition
                    ? finalDispositionLabel(expediente.appliedFinalDisposition)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Próxima transferencia</dt>
                <dd>{fmtDate(expediente.retentionDueAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rotulación carpeta / caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <LabelPreviewPanel
              expedienteId={expediente.id}
              expedienteCode={expediente.code}
              organizationName={expediente.organization?.name ?? "COOTRANSHUILA"}
              dependencyName={expediente.dependency.name}
              subsection={expediente.subsection}
              seriesName={expediente.series?.name}
              subseriesName={expediente.subseries?.name}
              folioStart={expediente.folioStart}
              folioEnd={expediente.folioEnd}
              folderNumber={folderNumber}
              boxCode={boxCode}
              dateStart={dateStart}
              dateEnd={dateEnd}
            />
            {canEdit && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Carpeta</Label>
                  <Input value={folderNumber} onChange={(e) => setFolderNumber(e.target.value)} />
                </div>
                <div>
                  <Label>Caja</Label>
                  <Input value={boxCode} onChange={(e) => setBoxCode(e.target.value)} placeholder="0045" />
                </div>
                <div>
                  <Label>Fecha inicial</Label>
                  <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
                </div>
                <div>
                  <Label>Fecha final</Label>
                  <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={saveLabels}>
                  Guardar rotulación
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/v1/expedientes/${expediente.id}/labels?type=folder`}
                className="inline-flex rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-900"
              >
                Descargar PDF carpeta
              </a>
              <a
                href={buildBoxLabelUrl(expediente.id, {
                  boxCode: boxCode || "0001",
                  section: expediente.dependency.name,
                  subsection: expediente.subsection ?? expediente.dependency.name,
                  series: expediente.series?.name ?? "",
                  subseries: expediente.subseries?.name ?? "",
                  code: expediente.code,
                  folderRange: folderNumber || "01",
                  dateStart,
                  dateEnd,
                })}
                className="inline-flex rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800"
              >
                Descargar PDF caja
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Documentos del expediente</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-2">#</th>
                <th className="pb-2">Código</th>
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Soporte</th>
                <th className="pb-2">Folios</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d, i) => (
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="py-2">{i + 1}</td>
                  <td className="py-2">
                    <Link href={`/documents/${d.id}`} className="text-blue-700 hover:underline">
                      {d.code}
                    </Link>
                  </td>
                  <td className="py-2">{d.name}</td>
                  <td className="py-2 text-xs">
                    {d.support ?? "PHYSICAL"}
                    {d.electronicFormat ? ` / ${d.electronicFormat}` : ""}
                  </td>
                  <td className="py-2">{d.folioCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            <Link href="/inventories" className="text-blue-600 hover:underline">
              Inventario FUID
            </Link>{" "}
            ·{" "}
            <Link href="/transfers" className="text-blue-600 hover:underline">
              Transferencia primaria
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
