"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X, Save, Shield } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { ROLE_THEME } from "@/shared/kernel/types";
import type { RoleCode } from "@prisma/client";

type Permission = {
  id: string;
  module: string;
  action: string;
  code: string;
  description: string | null;
};

type RoleItem = {
  id: string;
  code: RoleCode;
  name: string;
  description: string | null;
  accessLevel: number;
  permissions: { permissionId: string; permission: Permission }[];
  _count: { users: number; permissions: number };
};

export function RolesManager({
  initialRoles,
  permissions,
  canEdit,
  canDelete,
}: {
  initialRoles: RoleItem[];
  permissions: Permission[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [editing, setEditing] = useState<RoleItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessLevel, setAccessLevel] = useState(20);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries());
  }, [permissions]);

  function openEdit(role: RoleItem) {
    setEditing(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setAccessLevel(role.accessLevel);
    setSelectedPerms(new Set(role.permissions.map((p) => p.permissionId)));
  }

  function togglePerm(id: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModule(modulePerms: Permission[]) {
    const ids = modulePerms.map((p) => p.id);
    const allSelected = ids.every((id) => selectedPerms.has(id));
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function saveRole() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/roles/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          accessLevel,
          permissionIds: Array.from(selectedPerms),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "No se pudo actualizar el rol");
        return;
      }
      setRoles((prev) => prev.map((r) => (r.id === editing.id ? data.data : r)));
      toast.success("Rol actualizado");
      setEditing(null);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(role: RoleItem) {
    if (role.code === "SUPER_ADMIN") {
      toast.error("No se puede eliminar el Super Administrador");
      return;
    }
    if (role._count.users > 0) {
      toast.error(`Hay ${role._count.users} usuario(s) con este rol. Reasígnalos primero.`);
      return;
    }
    if (!confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;

    try {
      const res = await fetch(`/api/v1/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "No se pudo eliminar");
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      toast.success("Rol eliminado");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <Badge variant="info">{ROLE_THEME[r.code]?.label ?? r.code}</Badge>
                <div className="flex gap-1">
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Editar rol"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                  )}
                  {canDelete && r.code !== "SUPER_ADMIN" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Eliminar rol"
                      onClick={() => removeRole(r)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
              <CardTitle className="mt-2">{r.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>{r.description ?? "Sin descripción"}</p>
              <p>
                Nivel de acceso: <strong>{r.accessLevel}%</strong>
              </p>
              <p>Usuarios: {r._count.users}</p>
              <p>Permisos: {r._count.permissions}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <h2 className="font-semibold text-slate-900">Editar rol</h2>
                  <p className="text-xs text-slate-500">{editing.code}</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nivel de acceso (0-100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Permisos ({selectedPerms.size})</Label>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() =>
                      setSelectedPerms(
                        selectedPerms.size === permissions.length
                          ? new Set()
                          : new Set(permissions.map((p) => p.id))
                      )
                    }
                  >
                    {selectedPerms.size === permissions.length
                      ? "Quitar todos"
                      : "Seleccionar todos"}
                  </button>
                </div>
                <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
                  {grouped.map(([module, perms]) => (
                    <div key={module}>
                      <button
                        type="button"
                        onClick={() => toggleModule(perms)}
                        className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-blue-600"
                      >
                        {module}
                      </button>
                      <div className="grid gap-1 sm:grid-cols-2">
                        {perms.map((p) => (
                          <label
                            key={p.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPerms.has(p.id)}
                              onChange={() => togglePerm(p.id)}
                              className="rounded border-slate-300"
                            />
                            <span className="text-slate-700">{p.action}</span>
                            <span className="truncate text-[11px] text-slate-400">{p.code}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={saveRole} disabled={saving || !name.trim()}>
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
