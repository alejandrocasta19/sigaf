"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, FileText, FolderOpen, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";

type ResolveResult =
  | {
      type: "document";
      id: string;
      code: string;
      name: string;
      qrCode: string | null;
      status: string;
      dependency?: { name: string } | null;
      href: string;
    }
  | {
      type: "box";
      id: string;
      code: string;
      qrCode: string;
      status: string;
      location: string;
      folderCount: number;
      folders: string[];
      href: string;
    }
  | {
      type: "expediente";
      id: string;
      code: string;
      name: string;
      boxCode: string | null;
      href: string;
    };

export default function QrPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const q = encodeURIComponent(code.trim());
      const res = await fetch(`/api/v1/qr/resolve?q=${q}`, { credentials: "include" });
      const json = await res.json();
      if (json.success && json.data) {
        setResult(json.data as ResolveResult);
      } else {
        setError(json.error || "No se encontró ningún registro con ese código QR");
      }
    } catch {
      setError("Error al consultar el código");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Escáner QR</h1>
        <p className="text-sm text-slate-500">
          Resuelve documentos, cajas y expedientes (lector USB o pegado de texto)
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Resolver código
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleResolve} className="flex gap-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Escanee o pegue el código QR..."
              className="flex-1 font-mono text-sm"
              autoFocus
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Consultando..." : "Consultar"}
            </Button>
          </form>

          <p className="text-[11px] text-slate-500">
            Formatos: <code className="rounded bg-slate-100 px-1">SIGAF:BOX:CAJ-004</code>, JSON
            legado de caja, QR de documento o código de expediente.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {result?.type === "box" && (
            <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-teal-800">
                <Archive className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Caja</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{result.code}</p>
              <p className="mt-1 text-sm text-slate-700">{result.location}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="muted">{result.qrCode}</Badge>
                <Badge variant="info">{result.folderCount} carpetas</Badge>
                <Badge variant="success">{result.status}</Badge>
              </div>
              {result.folders.length > 0 && (
                <p className="mt-2 text-xs text-slate-600">
                  Carpetas: {result.folders.join(", ")}
                  {result.folderCount > result.folders.length ? "…" : ""}
                </p>
              )}
              <Link
                href={result.href}
                className="mt-3 inline-block text-sm font-medium text-teal-800 hover:underline"
              >
                Abrir en Archivo físico →
              </Link>
            </div>
          )}

          {result?.type === "document" && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-emerald-800">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Documento</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{result.code}</p>
              <p className="mt-1 text-slate-700">{result.name}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="muted">{result.qrCode ?? "sin QR"}</Badge>
                <Badge variant="info">{result.dependency?.name ?? "—"}</Badge>
                <Badge variant="success">{result.status}</Badge>
              </div>
              <Link
                href={result.href}
                className="mt-3 inline-block text-sm text-blue-700 hover:underline"
              >
                Abrir documento →
              </Link>
            </div>
          )}

          {result?.type === "expediente" && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-blue-800">
                <FolderOpen className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Expediente</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{result.code}</p>
              <p className="mt-1 text-slate-700">{result.name}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="info">Caja: {result.boxCode ?? "—"}</Badge>
              </div>
              <Link
                href={result.href}
                className="mt-3 inline-block text-sm text-blue-700 hover:underline"
              >
                Abrir expediente →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
