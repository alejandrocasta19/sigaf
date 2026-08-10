"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  X,
  Save,
  Lock,
  Unlock,
  KeyRound,
  Copy,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { formatDate } from "@/shared/kernel/utils";
import { StatusBadge, userStatusLabel } from "@/shared/list/status-labels";

type RoleOption = { id: string; name: string; code: string };
type DepOption = { id: string; name: string };
type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: "ACTIVE" | "BLOCKED" | "INACTIVE";
  lastLoginAt: string | Date | null;
  roleId: string;
  dependencyId: string | null;
  role: RoleOption;
  dependency: DepOption | null;
};

export function UsersManager({
  initialUsers,
  roles,
  dependencies,
  currentUserId,
  canManage,
}: {
  initialUsers: UserRow[];
  roles: RoleOption[];
  dependencies: DepOption[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [roleId, setRoleId] = useState("");
  const [dependencyId, setDependencyId] = useState("");
  const [status, setStatus] = useState<UserRow["status"]>("ACTIVE");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [customPassword, setCustomPassword] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roleId: roles.find((r) => r.code === "DEPT_WORKER")?.id ?? roles[0]?.id ?? "",
    dependencyId: "",
  });

  function openEdit(u: UserRow) {
    setEditing(u);
    setRoleId(u.roleId);
    setDependencyId(u.dependencyId ?? "");
    setStatus(u.status);
    setEditFirstName(u.firstName);
    setEditLastName(u.lastName);
    setEditEmail(u.email);
    setEditPassword("");
  }

  async function saveUser() {
    if (!editing) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      toast.error("Nombre y apellido son obligatorios");
      return;
    }
    if (!editEmail.trim()) {
      toast.error("El correo es obligatorio");
      return;
    }
    if (editPassword.trim() && editPassword.trim().length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        roleId,
        dependencyId: dependencyId || null,
        status,
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim(),
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      const res = await fetch(`/api/v1/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "No se pudo actualizar");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === editing.id ? data.data : u)));
      toast.success(
        editPassword.trim()
          ? "Usuario actualizado (contraseña cambiada; sesiones cerradas)"
          : "Usuario actualizado"
      );
      setEditing(null);
      setEditPassword("");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  async function toggleBlock(u: UserRow) {
    if (u.id === currentUserId) {
      toast.error("No puedes bloquearte a ti mismo");
      return;
    }
    const next = u.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    const label = next === "BLOCKED" ? "bloquear" : "desbloquear";
    if (!confirm(`¿${label.charAt(0).toUpperCase() + label.slice(1)} a ${u.firstName} ${u.lastName}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/users/${u.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || `No se pudo ${label}`);
        return;
      }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data.data : x)));
      toast.success(next === "BLOCKED" ? "Usuario bloqueado" : "Usuario desbloqueado");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    }
  }

  async function resetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    setTempPassword(null);
    try {
      const res = await fetch(`/api/v1/users/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          customPassword.trim().length >= 6 ? { password: customPassword.trim() } : {}
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "No se pudo restablecer");
        return;
      }
      setTempPassword(data.data.temporaryPassword);
      toast.success("Contraseña restablecida. Las sesiones del usuario fueron cerradas.");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setResetting(false);
    }
  }

  async function removeUser(u: UserRow) {
    if (u.id === currentUserId) {
      toast.error("No puedes eliminarte a ti mismo");
      return;
    }
    if (!confirm(`¿Eliminar al usuario ${u.firstName} ${u.lastName}?`)) return;
    try {
      const res = await fetch(`/api/v1/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "No se pudo eliminar");
        return;
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success("Usuario eliminado");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    }
  }

  async function createUser() {
    if (!createForm.firstName.trim() || !createForm.lastName.trim()) {
      toast.error("Indique nombre y apellido");
      return;
    }
    if (!createForm.email.trim()) {
      toast.error("Indique el correo");
      return;
    }
    if (createForm.password.trim().length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (!createForm.roleId) {
      toast.error("Seleccione un rol");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: createForm.firstName.trim(),
          lastName: createForm.lastName.trim(),
          email: createForm.email.trim(),
          password: createForm.password.trim(),
          roleId: createForm.roleId,
          dependencyId: createForm.dependencyId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "No se pudo crear el usuario");
        return;
      }
      setUsers((prev) => [data.data, ...prev]);
      toast.success("Usuario creado");
      setShowCreate(false);
      setCreateForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        roleId: roles.find((r) => r.code === "DEPT_WORKER")?.id ?? roles[0]?.id ?? "",
        dependencyId: "",
      });
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Agregar usuario
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-slate-500">
              <th className="pb-3 font-medium">Usuario</th>
              <th className="pb-3 font-medium">Correo</th>
              <th className="pb-3 font-medium">Rol</th>
              <th className="pb-3 font-medium">Dependencia</th>
              <th className="pb-3 font-medium">Estado</th>
              <th className="pb-3 font-medium">Último acceso</th>
              {canManage && <th className="pb-3 font-medium">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={`${u.firstName} ${u.lastName}`}
                      src={u.avatarUrl}
                      className="h-8 w-8"
                    />
                    <span className="font-medium text-slate-800">
                      {u.firstName} {u.lastName}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-slate-600">{u.email}</td>
                <td className="py-3">
                  <StatusBadge label={u.role.name} variant="info" />
                </td>
                <td className="py-3 text-slate-600">{u.dependency?.name ?? "—"}</td>
                <td className="py-3">
                  <StatusBadge
                    label={userStatusLabel(u.status)}
                    variant={
                      u.status === "ACTIVE"
                        ? "success"
                        : u.status === "BLOCKED"
                          ? "danger"
                          : "warning"
                    }
                  />
                </td>
                <td className="py-3 text-slate-500">
                  {u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}
                </td>
                {canManage && (
                  <td className="py-3">
                    <div className="flex gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(u)}
                        title="Editar / cambiar rol"
                      >
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleBlock(u)}
                        title={u.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                        disabled={u.id === currentUserId}
                      >
                        {u.status === "BLOCKED" ? (
                          <Unlock className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Lock className="h-4 w-4 text-amber-600" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setResetTarget(u);
                          setCustomPassword("");
                          setTempPassword(null);
                        }}
                        title="Restablecer contraseña"
                      >
                        <KeyRound className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeUser(u)}
                        title="Eliminar"
                        disabled={u.id === currentUserId}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Nuevo usuario</h2>
              <Button size="icon" variant="ghost" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input
                    value={createForm.firstName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, firstName: e.target.value })
                    }
                    placeholder="Juan"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellido</Label>
                  <Input
                    value={createForm.lastName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, lastName: e.target.value })
                    }
                    placeholder="Pérez"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Correo</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  placeholder="usuario@empresa.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contraseña</Label>
                <Input
                  type="text"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, password: e.target.value })
                  }
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={createForm.roleId}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, roleId: e.target.value })
                  }
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Dependencia (opcional)</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={createForm.dependencyId}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, dependencyId: e.target.value })
                  }
                >
                  <option value="">Sin dependencia</option>
                  {dependencies.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button onClick={createUser} disabled={creating}>
                <UserPlus className="h-4 w-4" />
                {creating ? "Creando..." : "Crear usuario"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Editar usuario</h2>
              <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Actualiza datos de acceso y perfil del usuario
            </p>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellido</Label>
                  <Input
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Correo</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nueva contraseña</Label>
                <Input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder=""
                />
                <p className="text-[11px] text-slate-400">
                  Si la cambias, se cierran las sesiones activas del usuario.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Dependencia</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={dependencyId}
                  onChange={(e) => setDependencyId(e.target.value)}
                >
                  <option value="">Sin dependencia</option>
                  {dependencies.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserRow["status"])}
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="BLOCKED">Bloqueado</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={saveUser} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Restablecer contraseña</h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setResetTarget(null);
                  setTempPassword(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              {resetTarget.firstName} {resetTarget.lastName} · {resetTarget.email}
            </p>
            {!tempPassword ? (
              <>
                <div className="space-y-1.5">
                  <Label>Nueva contraseña (opcional)</Label>
                  <Input
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Vacío = generar automática"
                  />
                  <p className="text-[11px] text-slate-400">Mínimo 6 caracteres si la defines.</p>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setResetTarget(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={resetPassword} disabled={resetting}>
                    <KeyRound className="h-4 w-4" />
                    {resetting ? "Restableciendo..." : "Restablecer"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-emerald-700">
                  Contraseña temporal (cópiala ahora; no se volverá a mostrar):
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <code className="flex-1 text-sm font-semibold text-slate-900">
                    {tempPassword}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await navigator.clipboard.writeText(tempPassword);
                      toast.success("Copiada");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setResetTarget(null);
                    setTempPassword(null);
                  }}
                >
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
