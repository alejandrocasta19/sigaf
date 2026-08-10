"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function SecuritySettingsForm({
  initial,
}: {
  initial: {
    passwordMinLength: number;
    mfaEnabled: boolean;
    ldapEnabled: boolean;
    emailNotifications: boolean;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "security.policy", value: form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      await fetch("/api/v1/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "notifications.emailEnabled",
          value: form.emailNotifications,
        }),
      });
      toast.success("Política de seguridad guardada");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Política editable</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Longitud mínima de contraseña</Label>
          <Input
            type="number"
            min={6}
            value={form.passwordMinLength}
            onChange={(e) =>
              setForm({ ...form, passwordMinLength: Number(e.target.value) || 6 })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.mfaEnabled}
            onChange={(e) => setForm({ ...form, mfaEnabled: e.target.checked })}
          />
          MFA habilitado (flag; TOTP no implementado)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.ldapEnabled}
            onChange={(e) => setForm({ ...form, ldapEnabled: e.target.checked })}
          />
          LDAP/AD habilitado (flag; integración no implementada)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.emailNotifications}
            onChange={(e) =>
              setForm({ ...form, emailNotifications: e.target.checked })
            }
          />
          Notificaciones por correo (requiere SMTP_HOST)
        </label>
        <Button disabled={busy} onClick={save}>
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
