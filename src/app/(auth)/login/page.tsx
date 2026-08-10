"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2, Shield } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";

const SHOW_DEMO = process.env.NODE_ENV !== "production";

const DEMO_USERS = [
  { email: "super@sigaf.local", label: "Super Administrador" },
  { email: "documental@sigaf.local", label: "Gestión Documental" },
  { email: "jefe@sigaf.local", label: "Jefe de Dependencia" },
  { email: "funcionario@sigaf.local", label: "Funcionario" },
  { email: "consulta@sigaf.local", label: "Usuario de Consulta" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(SHOW_DEMO ? "super@sigaf.local" : "");
  const [password, setPassword] = useState(SHOW_DEMO ? "Sigaf2026!" : "");
  const [mfaCode, setMfaCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (needsMfa) {
        const res = await fetch("/api/auth/mfa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: mfaCode }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Código MFA inválido");
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }
      if (data.data?.requiresMfa) {
        setNeedsMfa(true);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1e3a8a_0%,_transparent_55%),radial-gradient(ellipse_at_bottom,_#0f172a_0%,_#020617_70%)]" />
      <Card className="relative z-10 w-full max-w-md border-slate-200/20 bg-white/95 shadow-2xl backdrop-blur">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
            <FolderOpen className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">SIGAF</CardTitle>
          <CardDescription className="text-center">
            {needsMfa
              ? "Ingrese el código de su aplicación autenticadora"
              : "Sistema Integral de Gestión de Archivos Físicos y Documentales"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {!needsMfa ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="mfa">Código MFA</Label>
                <Input
                  id="mfa"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                />
                <button
                  type="button"
                  className="text-xs text-blue-700 hover:underline"
                  onClick={() => {
                    setNeedsMfa(false);
                    setMfaCode("");
                  }}
                >
                  Volver al login
                </button>
              </div>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {needsMfa ? "Verificar MFA" : "Iniciar sesión"}
            </Button>
          </form>

          {SHOW_DEMO && !needsMfa && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Acceso demo rápido</p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => {
                      setEmail(u.email);
                      setPassword("Sigaf2026!");
                    }}
                    className="rounded-lg border border-slate-200 px-2 py-2 text-left text-[11px] text-slate-600 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span className="block font-semibold text-slate-800">{u.label}</span>
                    {u.email}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] text-slate-400">
                Contraseña demo: <code className="text-slate-600">Sigaf2026!</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
