"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";

type SearchResult = {
  id: string;
  code: string;
  name: string;
  qrCode: string;
  status: string;
  dependency?: { name: string };
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      setResults(json.success ? json.data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Búsqueda</h1>
        <p className="text-sm text-slate-500">
          Buscar documentos por texto, código, QR o código de barras
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Búsqueda avanzada</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Palabra clave, código, QR..."
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Buscando..." : "Buscar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {searched && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados ({results.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {results.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No se encontraron documentos
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="pb-3 font-medium">Código</th>
                    <th className="pb-3 font-medium">Nombre</th>
                    <th className="pb-3 font-medium">QR</th>
                    <th className="pb-3 font-medium">Dependencia</th>
                    <th className="pb-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="py-3 font-medium text-blue-700">{r.code}</td>
                      <td className="py-3 text-slate-800">{r.name}</td>
                      <td className="py-3 font-mono text-xs text-slate-500">{r.qrCode}</td>
                      <td className="py-3 text-slate-600">{r.dependency?.name ?? "—"}</td>
                      <td className="py-3">
                        <Badge variant="muted">{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
