"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { finalDispositionLabel } from "@/shared/kernel/archival-process";

type Dep = { id: string; code: string; name: string };
type Sub = {
  id: string;
  code: string;
  name: string;
  retentionManagementYears?: number | null;
  retentionCentralYears?: number | null;
  finalDisposition?: string | null;
};
type Series = {
  id: string;
  code: string;
  name: string;
  dependencyId?: string | null;
  seriesKind?: "SIMPLE" | "COMPOSITE";
  retentionManagementYears?: number | null;
  retentionCentralYears?: number | null;
  finalDisposition?: string | null;
  subseries: Sub[];
};

type TrdIdentificationStatus = {
  trd: {
    active: boolean;
    name: string | null;
    version: string | null;
    lastUpdated: string | null;
    seriesCount: number;
  };
  versionAlert: { show: boolean; message: string | null };
  checks: {
    trd: boolean;
    dependency: boolean;
    series: boolean;
    tramite: boolean;
    unique: boolean;
  };
  details: {
    dependencyName?: string;
    seriesName?: string;
    subseriesName?: string;
    duplicateExpedienteCode?: string;
  };
  messages: string[];
};

const EXPEDIENTE_TYPES = ["Serie compuesta", "Serie documental", "Asunto"];

const IDENTIFICATION_CHECKS = [
  { key: "trd" as const, label: "Consulté la TRD vigente" },
  { key: "dependency" as const, label: "Identifiqué la dependencia productora" },
  { key: "series" as const, label: "Identifiqué la serie/subserie" },
  { key: "tramite" as const, label: "Determiné el trámite" },
  { key: "unique" as const, label: "Verifiqué que no existe otro expediente para este trámite" },
];

const TOTAL_STEPS = 7;

export function ClassificationWizard({
  dependencies,
  series,
  defaultDependencyId,
  organizationName,
}: {
  dependencies: Dep[];
  series: Series[];
  defaultDependencyId?: string | null;
  organizationName?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [trdStatus, setTrdStatus] = useState<TrdIdentificationStatus | null>(null);
  const [trdLoading, setTrdLoading] = useState(false);
  const [dependencyId, setDependencyId] = useState(defaultDependencyId || dependencies[0]?.id || "");
  const [seriesId, setSeriesId] = useState("");
  const [subseriesId, setSubseriesId] = useState("");
  const [expedienteType, setExpedienteType] = useState("Serie compuesta");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  const filteredSeries = useMemo(
    () => series.filter((s) => !s.dependencyId || s.dependencyId === dependencyId),
    [series, dependencyId]
  );

  const selectedSeries = filteredSeries.find((s) => s.id === seriesId);
  const selectedSub = selectedSeries?.subseries.find((s) => s.id === subseriesId);
  const isSimpleSeries = selectedSeries?.seriesKind === "SIMPLE";

  const identProgress = useMemo(() => {
    if (!trdStatus) return { done: 0, total: 5 };
    const vals = Object.values(trdStatus.checks);
    return { done: vals.filter(Boolean).length, total: vals.length };
  }, [trdStatus]);

  const allIdentConfirmed = trdStatus
    ? IDENTIFICATION_CHECKS.every((c) => trdStatus.checks[c.key])
    : false;

  const refreshTrdIdentification = useCallback(async (): Promise<TrdIdentificationStatus | null> => {
    setTrdLoading(true);
    try {
      const qs = new URLSearchParams();
      if (dependencyId) qs.set("dependencyId", dependencyId);
      if (seriesId) qs.set("seriesId", seriesId);
      if (subseriesId) qs.set("subseriesId", subseriesId);
      if (subject.trim()) qs.set("subject", subject.trim());
      const res = await fetch(`/api/v1/trd/identification?${qs}`);
      const json = await res.json();
      if (res.ok && json.data) {
        const data = json.data as TrdIdentificationStatus;
        setTrdStatus(data);
        return data;
      }
      return null;
    } catch {
      return null;
    } finally {
      setTrdLoading(false);
    }
  }, [dependencyId, seriesId, subseriesId, subject]);

  useEffect(() => {
    void refreshTrdIdentification();
  }, [refreshTrdIdentification]);

  const retention = useMemo(() => {
    const ag = selectedSub?.retentionManagementYears ?? selectedSeries?.retentionManagementYears ?? 2;
    const ac = selectedSub?.retentionCentralYears ?? selectedSeries?.retentionCentralYears ?? 8;
    const disposition = selectedSub?.finalDisposition ?? selectedSeries?.finalDisposition ?? "CONSERVATION";
    return { ag, ac, disposition };
  }, [selectedSeries, selectedSub]);

  const hierarchyPreview = useMemo(() => {
    const dep = dependencies.find((d) => d.id === dependencyId);
    const lines: string[] = [organizationName ?? "COOTRANSHUILA"];
    if (dep) lines.push(dep.name);
    if (selectedSeries) lines.push(selectedSeries.name);
    if (selectedSub) lines.push(selectedSub.name);
    if (previewCode) lines.push(previewCode);
    if (subject.trim()) lines.push(`«${subject.trim()}»`);
    return lines;
  }, [dependencies, dependencyId, selectedSeries, selectedSub, previewCode, subject, organizationName]);

  async function loadPreviewCode() {
    if (!dependencyId) return;
    try {
      const qs = new URLSearchParams({ dependencyId, year: String(year) });
      if (seriesId) qs.set("seriesId", seriesId);
      const res = await fetch(`/api/v1/expedientes/preview-code?${qs}`);
      const json = await res.json();
      if (res.ok && json.data?.code) setPreviewCode(json.data.code);
    } catch {
      /* preview opcional */
    }
  }

  function canAdvanceFromStep() {
    if (step === 1) return trdStatus?.checks.trd === true;
    if (step === 2) return !!dependencyId;
    if (step === 3) return !!seriesId;
    if (step === 6) return !!subject.trim() && trdStatus?.checks.unique !== false;
    return true;
  }

  function IdentificationPanel({ compact }: { compact?: boolean }) {
    if (!trdStatus && trdLoading) {
      return <p className="text-xs text-slate-500">Validando TRD vigente…</p>;
    }
    if (!trdStatus) return null;

    return (
      <div className={compact ? "space-y-2" : "space-y-3"}>
        {!compact && trdStatus.trd.active && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
            <p className="font-medium text-emerald-900">
              TRD vigente: {trdStatus.trd.name ?? "Tabla de Retención Documental"}
            </p>
            <p className="text-xs text-emerald-800">
              Versión {trdStatus.trd.version ?? "—"} · {trdStatus.trd.seriesCount} series ·{" "}
              <Link href="/trd" className="underline">
                Ver TRD
              </Link>
            </p>
            {trdStatus.trd.lastUpdated && (
              <p className="text-xs text-slate-500">
                Actualizada: {new Date(trdStatus.trd.lastUpdated).toLocaleDateString("es-CO")}
              </p>
            )}
          </div>
        )}
        {trdStatus.versionAlert.show && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            {trdStatus.versionAlert.message}
          </div>
        )}
        <ul className={compact ? "space-y-1 text-xs" : "space-y-2 text-sm"}>
          {IDENTIFICATION_CHECKS.map((c) => {
            const done = trdStatus.checks[c.key];
            return (
              <li key={c.key} className="flex items-start gap-2">
                <span className={done ? "text-emerald-700" : "text-slate-400"}>{done ? "✓" : "○"}</span>
                <span className={done ? "text-emerald-900" : "text-slate-600"}>{c.label}</span>
              </li>
            );
          })}
        </ul>
        {!compact && (
          <p className="text-xs text-slate-500">
            Identificación {identProgress.done}/{identProgress.total} — se valida automáticamente contra la TRD.
          </p>
        )}
        {trdStatus.messages.length > 0 && (
          <ul className="space-y-1 text-xs text-amber-800">
            {trdStatus.messages.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  async function onContinue() {
    if (!canAdvanceFromStep()) {
      if (step === 1) toast.error("No hay TRD vigente activa en el sistema");
      else if (step === 6) {
        if (!subject.trim()) toast.error("Complete el asunto del trámite");
        else if (trdStatus?.details.duplicateExpedienteCode)
          toast.error(`Expediente duplicado: ${trdStatus.details.duplicateExpedienteCode}`);
      }
      return;
    }

    if (step < TOTAL_STEPS) {
      if (step === 3 && selectedSeries?.seriesKind === "SIMPLE") {
        setExpedienteType("Serie documental");
      }
      if (step === 6) await loadPreviewCode();
      setStep(step + 1);
      return;
    }

    if (!subject.trim() || !dependencyId) {
      toast.error("Complete dependencia y asunto del trámite");
      return;
    }

    const latestStatus = await refreshTrdIdentification();
    const ready =
      latestStatus &&
      IDENTIFICATION_CHECKS.every((c) => latestStatus.checks[c.key]);
    if (!ready) {
      toast.error("Complete la identificación archivística antes de crear el expediente");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/v1/expedientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subject.trim(),
          subject: subject.trim(),
          dependencyId,
          seriesId: seriesId || undefined,
          subseriesId: subseriesId || undefined,
          expedienteType,
          year,
          identificationConfirmed: true,
        }),
      });
      const text = await res.text();
      let json: { success?: boolean; data?: { id: string; code: string }; error?: string };
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Error del servidor — recargue la página e intente de nuevo");
      }
      if (!res.ok || !json.data) throw new Error(json.error || "Error al crear expediente");
      toast.success(`Expediente ${json.data.code} creado`);
      router.push(`/expedientes/${json.data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-emerald-200">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Asistente archivístico — Crear expediente</CardTitle>
        <p className="text-sm text-slate-500">
          Un trámite = un expediente único. El asunto describe el negocio, no el funcionario.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {step > 1 && (
          <div className="overflow-x-auto rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 sm:text-xs">
            {hierarchyPreview.map((line, i) => (
              <div key={i} className="whitespace-nowrap" style={{ paddingLeft: `${Math.min(i, 4) * 10}px` }}>
                {i > 0 ? "└── " : ""}
                {line}
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <p className="text-sm font-medium text-amber-900">Paso 1 — Diagnóstico e identificación</p>
            <p className="text-xs text-amber-800">
              El sistema valida la TRD vigente y completará los ítems conforme avance en clasificación.
            </p>
            <IdentificationPanel />
          </div>
        )}

        {step > 1 && step < TOTAL_STEPS && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <p className="mb-2 text-xs font-medium text-slate-600">
              Identificación archivística ({identProgress.done}/{identProgress.total})
            </p>
            <IdentificationPanel compact />
          </div>
        )}

        {step === 2 && (
          <div>
            <Label>2. Dependencia</Label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={dependencyId}
              onChange={(e) => {
                setDependencyId(e.target.value);
                setSeriesId("");
                setSubseriesId("");
              }}
            >
              {dependencies.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {step === 3 && (
          <div>
            <Label>3. Serie documental</Label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={seriesId}
              onChange={(e) => {
                setSeriesId(e.target.value);
                setSubseriesId("");
              }}
            >
              <option value="">Seleccione serie…</option>
              {filteredSeries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                  {s.seriesKind === "SIMPLE" ? " (serie simple)" : ""}
                </option>
              ))}
            </select>
            {isSimpleSeries && (
              <p className="mt-2 text-xs text-amber-700">
                Serie simple TRD: un solo tipo documental por expediente.
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <Label>4. Subserie</Label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={subseriesId}
              onChange={(e) => setSubseriesId(e.target.value)}
              disabled={!selectedSeries?.subseries.length}
            >
              <option value="">
                {selectedSeries?.subseries.length ? "Seleccione subserie…" : "Sin subseries — continúe"}
              </option>
              {(selectedSeries?.subseries ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {step === 5 && (
          <div>
            <Label>5. Tipo de expediente</Label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={expedienteType}
              onChange={(e) => setExpedienteType(e.target.value)}
              disabled={isSimpleSeries}
            >
              {EXPEDIENTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {selectedSeries && (
              <p className="mt-2 text-xs text-slate-500">
                TRD: {selectedSeries.seriesKind === "SIMPLE" ? "Serie simple" : "Serie compuesta"}
              </p>
            )}
          </div>
        )}

        {step === 6 && (
          <div>
            <Label>6. Asunto del trámite</Label>
            <Input
              className="mt-1"
              placeholder="Ej. Contrato de mantenimiento sede Neiva"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-amber-700">
              Evite carpetas acumulativas: un asunto concreto por expediente.
            </p>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-3">
            <IdentificationPanel compact />
            <div>
              <Label>7. Año</Label>
              <Input
                type="number"
                className="mt-1"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
              />
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
              <p className="font-medium text-emerald-900">Clasificación (TRD oficial)</p>
              <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Código</dt>
                  <dd className="font-mono font-semibold">{previewCode ?? "…"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Ciclo vital</dt>
                  <dd>Archivo de Gestión</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Retención gestión</dt>
                  <dd>{retention.ag} años</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Retención central</dt>
                  <dd>{retention.ac} años</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Disposición final</dt>
                  <dd>{finalDispositionLabel(retention.disposition)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {step > 1 && (
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setStep(step - 1)}>
              Atrás
            </Button>
          )}
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void onContinue()}
            disabled={busy || !canAdvanceFromStep() || (step === TOTAL_STEPS && !allIdentConfirmed)}
          >
            {busy ? "Creando…" : step === TOTAL_STEPS ? "Crear expediente" : "Continuar"}
          </Button>
        </div>
        <p className="text-xs text-slate-400">Paso {step} de {TOTAL_STEPS}</p>
      </CardContent>
    </Card>
  );
}
