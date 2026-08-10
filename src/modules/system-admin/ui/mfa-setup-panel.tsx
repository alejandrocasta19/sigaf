"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function MfaSetupPanel() {
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/v1/auth/mfa");
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Error MFA");
      return;
    }
    setEnabled(Boolean(json.data.enabled));
    if (json.data.setup) {
      setSecret(json.data.setup.secret);
      setOtpauth(json.data.setup.otpauth);
      const dataUrl = await QRCode.toDataURL(json.data.setup.otpauth, { width: 180 });
      setQr(dataUrl);
    } else {
      setSecret(null);
      setOtpauth(null);
      setQr(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function enable() {
    if (!secret || !code) {
      toast.error("Ingrese el código de 6 dígitos");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("MFA activado");
      setCode("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!code) {
      toast.error("Ingrese el código MFA actual");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/mfa", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("MFA desactivado");
      setCode("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>MFA TOTP (tu cuenta)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500">
          {enabled
            ? "MFA activo. Para desactivar, confirme con un código de su app autenticadora."
            : "Escanee el QR con Google Authenticator / Authy y confirme el código."}
        </p>
        {!enabled && qr && (
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR MFA" className="rounded border border-slate-200" />
            <div className="text-xs text-slate-500">
              <p className="font-medium text-slate-700">Secreto (backup)</p>
              <code className="break-all">{secret}</code>
              {otpauth && (
                <p className="mt-2 max-w-sm break-all opacity-70">{otpauth}</p>
              )}
            </div>
          </div>
        )}
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
          <Input
            id="mfa-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>
        {enabled ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void disable()}>
            Desactivar MFA
          </Button>
        ) : (
          <Button type="button" disabled={busy || !secret} onClick={() => void enable()}>
            Activar MFA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
