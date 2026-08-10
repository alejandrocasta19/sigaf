"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { StatusBadge } from "@/shared/list/status-labels";

type ModuleRow = { name: string; key: string; active: boolean };

export function ModulesSettingsForm({
  initial,
}: {
  initial: ModuleRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);

  function toggle(key: string) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, active: !r.active } : r))
    );
  }

  async function save() {
    setBusy(true);
    try {
      const value = Object.fromEntries(rows.map((r) => [r.key, r.active]));
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "modules.enabled", value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Módulos guardados");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs text-slate-500">
            <th className="pb-3 font-medium">Módulo</th>
            <th className="pb-3 font-medium">Clave</th>
            <th className="pb-3 font-medium">Estado</th>
            <th className="pb-3 font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.key} className="border-b border-slate-50">
              <td className="py-3 font-medium text-slate-800">{m.name}</td>
              <td className="py-3 font-mono text-xs text-slate-500">{m.key}</td>
              <td className="py-3">
                <StatusBadge
                  label={m.active ? "Activo" : "Inactivo"}
                  variant={m.active ? "success" : "muted"}
                />
              </td>
              <td className="py-3">
                <Button size="sm" variant="outline" type="button" onClick={() => toggle(m.key)}>
                  {m.active ? "Desactivar" : "Activar"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button disabled={busy} onClick={save}>
        Guardar
      </Button>
    </div>
  );
}
