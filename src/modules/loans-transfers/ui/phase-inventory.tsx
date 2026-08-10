"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ArchivalPhase } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { TransferActions } from "@/modules/loans-transfers/ui/transfer-actions";

type DocRow = {
  id: string;
  code: string;
  name: string;
  dependency: { name: string };
  series: { name: string } | null;
};

type ExpRow = {
  id: string;
  code: string;
  name: string;
  dependency: { name: string };
};

export function PhaseInventory({
  phase,
  documents,
  expedientes,
  canComplete,
}: {
  phase: ArchivalPhase;
  documents: DocRow[];
  expedientes: ExpRow[];
  canComplete: boolean;
}) {
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [selectedExps, setSelectedExps] = useState<Set<string>>(new Set());

  const docIds = useMemo(() => Array.from(selectedDocs), [selectedDocs]);
  const expIds = useMemo(() => Array.from(selectedExps), [selectedExps]);

  function toggleDoc(id: string) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExp(id: string) {
    setSelectedExps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>
            Selección para transferencia ({docIds.length + expIds.length})
          </CardTitle>
          <TransferActions
            phase={phase}
            documentIds={docIds}
            expedienteIds={expIds}
            canComplete={canComplete}
          />
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documentos en esta fase</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-1 overflow-y-auto">
            {documents.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedDocs.has(d.id)}
                  onChange={() => toggleDoc(d.id)}
                />
                <span className="min-w-0 text-sm">
                  <Link href={`/documents/${d.id}`} className="font-medium text-blue-700 hover:underline">
                    {d.code}
                  </Link>
                  <span className="block truncate text-slate-700">{d.name}</span>
                  <span className="text-[11px] text-slate-400">
                    {d.dependency.name}
                    {d.series ? ` · ${d.series.name}` : ""}
                  </span>
                </span>
              </label>
            ))}
            {documents.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">Sin documentos</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expedientes en esta fase</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 space-y-1 overflow-y-auto">
            {expedientes.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedExps.has(e.id)}
                  onChange={() => toggleExp(e.id)}
                />
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-slate-800">{e.code}</span>
                  <span className="block truncate text-slate-700">{e.name}</span>
                  <span className="text-[11px] text-slate-400">{e.dependency.name}</span>
                </span>
              </label>
            ))}
            {expedientes.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">Sin expedientes</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
