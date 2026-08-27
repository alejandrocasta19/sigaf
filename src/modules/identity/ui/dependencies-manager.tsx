"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { StatusBadge } from "@/shared/list/status-labels";
import { formatDate } from "@/shared/kernel/utils";

export type DependencyRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string | Date;
  _count: { users: number; documents: number; expedientes: number };
};

export function DependenciesManager({
  initialDeps,
  canManage,
}: {
  initialDeps: DependencyRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [deps, setDeps] = useState(initialDeps);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "" });

  async function createDep() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Indique código y nombre");
      return;
    }
    setSaving(true);
    try {
      const csrfToken =
        document.cookie.match(/(?:^|;\s*)sigaf_csrf=([^;]*)/)?.[1] ?? "";
      const res = await fetch("/api/v1/dependencies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": decodeURIComponent(csrfToken),
        },
        credentials: "include",
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "No se pudo crear la dependencia");
        return;
      }
      const created = json.data as DependencyRow;
      setDeps((prev) => {
        const without = prev.filter((d) => d.id !== created.id);
        return [
          {
            ...created,
            _count: created._count ?? { users: 0, documents: 0, expedientes: 0 },
          },
          ...without,
        ].sort((a, b) => a.code.localeCompare(b.code));
      });
      toast.success(`Dependencia ${created.code} — ${created.name} creada`);
      setForm({ code: "", name: "", description: "" });
      setShowForm(false);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(dep: DependencyRow) {
    try {
      const csrfToken =
        document.cookie.match(/(?:^|;\s*)sigaf_csrf=([^;]*)/)?.[1] ?? "";
      const res = await fetch(`/api/v1/dependencies/${dep.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": decodeURIComponent(csrfToken),
        },
        credentials: "include",
        body: JSON.stringify({ active: !dep.active }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "No se pudo actualizar");
        return;
      }
      setDeps((prev) => prev.map((d) => (d.id === dep.id ? { ...d, active: !dep.active } : d)));
      toast.success(dep.active ? "Dependencia desactivada" : "Dependencia activada");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Nueva dependencia
          </Button>
        </div>
      )}

      {showForm && canManage && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Building2 className="h-4 w-4 text-blue-600" />
            Registrar dependencia
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="dep-code">Código TRD</Label>
              <Input
                id="dep-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="Ej. 40"
                maxLength={12}
              />
              <p className="text-[11px] text-slate-500">Único en la entidad (p. ej. 20 Gerencia)</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dep-name">Nombre</Label>
              <Input
                id="dep-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Talento Humano"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="dep-desc">Descripción (opcional)</Label>
              <Input
                id="dep-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Oficina o sección productora"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={createDep} disabled={saving}>
              {saving ? "Guardando…" : "Crear dependencia"}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-slate-500">
              <th className="pb-3 font-medium">Código</th>
              <th className="pb-3 font-medium">Nombre</th>
              <th className="pb-3 font-medium">Usuarios</th>
              <th className="pb-3 font-medium">Expedientes</th>
              <th className="pb-3 font-medium">Documentos</th>
              <th className="pb-3 font-medium">Estado</th>
              <th className="pb-3 font-medium">Creada</th>
              {canManage && <th className="pb-3 font-medium">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {deps.map((d) => (
              <tr key={d.id} className="border-b border-slate-50">
                <td className="py-3 font-mono font-medium">{d.code}</td>
                <td className="py-3 text-slate-800">
                  <p>{d.name}</p>
                  {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
                </td>
                <td className="py-3 text-slate-600">{d._count.users}</td>
                <td className="py-3 text-slate-600">{d._count.expedientes}</td>
                <td className="py-3 text-slate-600">{d._count.documents}</td>
                <td className="py-3">
                  <StatusBadge
                    label={d.active ? "Activa" : "Inactiva"}
                    variant={d.active ? "success" : "muted"}
                  />
                </td>
                <td className="py-3 text-slate-500">{formatDate(d.createdAt)}</td>
                {canManage && (
                  <td className="py-3">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(d)}>
                      {d.active ? "Desactivar" : "Activar"}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {deps.length === 0 && (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="py-8 text-center text-slate-500">
                  No hay dependencias. Cree la primera con el botón de arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
