"use client";

import { useState } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";

type SearchResult = {
  id: string;
  code: string;
  name: string;
  qrCode: string | null;
  status: string;
  dependency?: { name: string };
};

export default function QrPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
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
      const res = await fetch(`/api/v1/search?q=${q}&exactQr=1`);
      const json = await res.json();
      const items = (json.data?.documents ?? json.data?.items ?? json.data ?? []) as SearchResult[];
      const exact =
        items.find(
          (d) =>
            d.qrCode?.toLowerCase() === code.trim().toLowerCase() ||
            d.code?.toLowerCase() === code.trim().toLowerCase()
        ) ?? items[0];
      if (json.success && exact) {
        setResult(exact);
      } else {
        setError("No se encontró ningún documento con ese código QR");
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
        <h1 className="text-2xl font-bold text-slate-900">Escáner QR</h1>
        <p className="text-sm text-slate-500">
          Consulte por código QR exacto (lector USB / pegado de texto)
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
              placeholder="Escanee o ingrese el código QR..."
              className="flex-1"
              autoFocus
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Consultando..." : "Consultar"}
            </Button>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {result && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-lg font-bold text-slate-900">{result.code}</p>
              <p className="mt-1 text-slate-700">{result.name}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="muted">{result.qrCode ?? "sin QR"}</Badge>
                <Badge variant="info">{result.dependency?.name ?? "—"}</Badge>
                <Badge variant="success">{result.status}</Badge>
              </div>
              <Link
                href={`/documents/${result.id}`}
                className="mt-3 inline-block text-sm text-blue-700 hover:underline"
              >
                Abrir documento →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
