"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const VALUE_FIELDS = [
  ["valueAdministrative", "Administrativo"],
  ["valueJuridical", "Jurídico"],
  ["valueLegal", "Legal"],
  ["valueFiscal", "Fiscal"],
  ["valueAccounting", "Contable"],
  ["valueHistorical", "Histórico"],
] as const;

export function TrdAdminPanel({
  dependencies,
  series,
}: {
  dependencies: { id: string; code: string; name: string }[];
  series: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    dependencyId: "",
    retentionManagementYears: 2,
    retentionCentralYears: 3,
    finalDisposition: "SELECTION",
    valueAdministrative: true,
    valueJuridical: false,
    valueLegal: false,
    valueFiscal: false,
    valueAccounting: false,
    valueHistorical: false,
  });
  const [extra, setExtra] = useState({
    seriesId: "",
    subCode: "",
    subName: "",
    typCode: "",
    typName: "",
  });

  async function createSeries() {
    if (!form.code || !form.name) {
      toast.error("Código y nombre requeridos");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/trd/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_series",
          ...form,
          dependencyId: form.dependencyId || null,
          retentionManagementYears: Number(form.retentionManagementYears),
          retentionCentralYears: Number(form.retentionCentralYears),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Serie creada (retención calculada por valores)");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function importExcel(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/trd/manage", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error importando");
      toast.success(
        `Importadas ${json.data.createdSeries} series y ${json.data.createdSubs} subseries`
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function snapshot() {
    const version = prompt("Versión TRD (ej. 1.1)", "1.1");
    if (!version) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/trd/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snapshot", version }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Versión TRD guardada");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function createSubseries() {
    if (!extra.seriesId || !extra.subCode || !extra.subName) {
      toast.error("Serie, código y nombre de subserie requeridos");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/trd/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_subseries",
          seriesId: extra.seriesId,
          code: extra.subCode,
          name: extra.subName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Subserie creada");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function createTypology() {
    if (!extra.typCode || !extra.typName) {
      toast.error("Código y nombre de tipología requeridos");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/trd/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_typology",
          code: extra.typCode,
          name: extra.typName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Tipología TRD creada");
      router.refresh();
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
          <CardTitle>Nueva serie TRD</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Código</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="08"
            />
          </div>
          <div>
            <Label>Nombre</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Dependencia</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.dependencyId}
              onChange={(e) => setForm({ ...form, dependencyId: e.target.value })}
            >
              <option value="">Institucional</option>
              {dependencies.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>AG (años base)</Label>
            <Input
              type="number"
              value={form.retentionManagementYears}
              onChange={(e) =>
                setForm({ ...form, retentionManagementYears: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>AC (años base)</Label>
            <Input
              type="number"
              value={form.retentionCentralYears}
              onChange={(e) =>
                setForm({ ...form, retentionCentralYears: Number(e.target.value) })
              }
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-3 text-sm">
            {VALUE_FIELDS.map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          <Button disabled={busy} onClick={createSeries} className="bg-emerald-600 hover:bg-emerald-700">
            Crear serie
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importar / exportar / versionar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a href="/api/v1/trd/manage?view=export">
            <Button type="button" variant="outline" className="w-full">
              Exportar TRD (Excel)
            </Button>
          </a>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Importar Excel TRD</span>
            <Input
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={(e) => importExcel(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button type="button" variant="secondary" disabled={busy} onClick={snapshot}>
            Guardar versión (snapshot)
          </Button>
          <p className="text-xs text-slate-500">
            El cálculo automático ajusta AG/AC y disposición según valores documentales
            (histórico → conservación; fiscal/jurídico → mayor retención).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subserie / tipología TRD</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Serie padre</Label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={extra.seriesId}
              onChange={(e) => setExtra({ ...extra, seriesId: e.target.value })}
            >
              <option value="">Seleccione serie</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Código subserie</Label>
            <Input
              value={extra.subCode}
              onChange={(e) => setExtra({ ...extra, subCode: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Nombre subserie</Label>
            <Input
              value={extra.subName}
              onChange={(e) => setExtra({ ...extra, subName: e.target.value })}
            />
          </div>
          <Button disabled={busy} variant="outline" onClick={createSubseries}>
            Crear subserie
          </Button>
          <div className="sm:col-span-2 border-t pt-3">
            <Label>Tipología (no es formato de archivo)</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Código"
                value={extra.typCode}
                onChange={(e) => setExtra({ ...extra, typCode: e.target.value })}
              />
              <Input
                placeholder="Nombre (ej. Acta, Resolución)"
                value={extra.typName}
                onChange={(e) => setExtra({ ...extra, typName: e.target.value })}
              />
            </div>
            <Button className="mt-2" disabled={busy} variant="outline" onClick={createTypology}>
              Crear tipología
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
