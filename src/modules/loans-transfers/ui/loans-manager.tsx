"use client";

import { useMemo, useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  loanStatusLabel,
  loanStatusVariant,
  StatusBadge,
} from "@/shared/list/status-labels";
import {
  DocumentFileViewer,
  type PreviewFile,
} from "@/modules/documents/ui/document-file-viewer";
import type { LoanStatus } from "@prisma/client";

export type LoanRow = {
  id: string;
  code: string;
  status: LoanStatus;
  notes: string | null;
  requestedAt: string;
  dueDate: string | null;
  approvedAt: string | null;
  returnedAt: string | null;
  requesterId: string;
  document: {
    id: string;
    code: string;
    name: string;
    dependency: { name: string };
    previewFiles: PreviewFile[];
  };
  requester: { firstName: string; lastName: string };
  approver: { firstName: string; lastName: string } | null;
};

type AvailableDoc = {
  id: string;
  code: string;
  name: string;
  dependency: { name: string };
};

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function dueHint(dueDate: string | null, status: LoanStatus) {
  if (!dueDate || status === "RETURNED" || status === "REJECTED") return null;
  const due = new Date(dueDate).getTime();
  const diffMs = due - Date.now();
  if (status === "OVERDUE" || diffMs < 0) {
    return "Vencido — solicite de nuevo si necesita continuar";
  }
  const totalMin = Math.max(1, Math.round(diffMs / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) return "Plazo de préstamo: 24 horas";
  if (h <= 0) return `Vence en ~${m} min (máx. 24 h)`;
  return `Vence en ~${h} h ${m} min (máx. 24 h)`;
}

export function LoansManager({
  loans,
  currentUserId,
  roleCode,
  canCreate,
  canApprove,
}: {
  loans: LoanRow[];
  currentUserId: string;
  roleCode: string;
  canCreate: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [docs, setDocs] = useState<AvailableDoc[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isGestora = ["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(roleCode);

  async function loadDocs(query = "") {
    setLoadingDocs(true);
    try {
      const res = await fetch(
        `/api/v1/loans?available=1${query ? `&q=${encodeURIComponent(query)}` : ""}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setDocs(json.data as AvailableDoc[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar documentos");
    } finally {
      setLoadingDocs(false);
    }
  }

  async function requestLoan() {
    if (!documentId) {
      toast.error("Seleccione un documento");
      return;
    }
    setBusy("request");
    try {
      const res = await fetch("/api/v1/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, notes: notes.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Solicitud enviada — pendiente de aprobación");
      setDocumentId("");
      setNotes("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, action: "approve" | "reject" | "return") {
    setBusy(`${id}:${action}`);
    try {
      const res = await fetch(`/api/v1/loans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success(
        action === "approve"
          ? "Préstamo aprobado — documento entregado (24h)"
          : action === "reject"
            ? "Préstamo rechazado"
            : "Documento devuelto"
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const sorted = useMemo(() => loans, [loans]);

  return (
    <div className="space-y-6">
      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Solicitar préstamo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              Gestión Documental aprueba o rechaza. Si se aprueba, el documento queda
              entregado por un máximo de 24 horas.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                className="min-w-[200px] flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Buscar por código o nombre…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingDocs}
                onClick={() => loadDocs(q)}
              >
                {loadingDocs ? "Buscando…" : "Buscar disponibles"}
              </Button>
            </div>
            <select
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              onFocus={() => {
                if (docs.length === 0) void loadDocs(q);
              }}
            >
              <option value="">Seleccione documento ACTIVE…</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name} ({d.dependency.name})
                </option>
              ))}
            </select>
            <textarea
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              rows={2}
              placeholder="Notas (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              type="button"
              disabled={busy === "request" || !documentId}
              onClick={() => void requestLoan()}
            >
              {busy === "request" ? "Enviando…" : "Solicitar préstamo"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Préstamos ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {sorted.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No hay préstamos registrados.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="pb-3 font-medium">Código</th>
                  <th className="pb-3 font-medium">Documento</th>
                  <th className="pb-3 font-medium">Solicitante</th>
                  <th className="pb-3 font-medium">Dependencia</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Vence (24h)</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => {
                  const hint = dueHint(l.dueDate, l.status);
                  const canReturn =
                    (l.status === "ACTIVE" ||
                      l.status === "OVERDUE" ||
                      l.status === "APPROVED") &&
                    (isGestora || l.requesterId === currentUserId);
                  const showApprove = canApprove && l.status === "REQUESTED";
                  const isOpen = expandedId === l.id;

                  return (
                    <Fragment key={l.id}>
                      <tr className="border-b border-slate-50">
                        <td className="py-3 font-medium">{l.code}</td>
                        <td className="py-3">
                          <Link
                            href={`/documents/${l.document.id}`}
                            className="font-medium text-blue-700 hover:underline"
                          >
                            {l.document.code}
                          </Link>
                          <p className="text-xs text-slate-500">{l.document.name}</p>
                        </td>
                        <td className="py-3 text-slate-600">
                          {l.requester.firstName} {l.requester.lastName}
                        </td>
                        <td className="py-3 text-slate-600">
                          {l.document.dependency.name}
                        </td>
                        <td className="py-3">
                          <StatusBadge
                            label={loanStatusLabel(l.status)}
                            variant={loanStatusVariant(l.status)}
                          />
                          {hint && (
                            <p className="mt-1 text-xs text-amber-700">{hint}</p>
                          )}
                        </td>
                        <td className="py-3 text-slate-500">{formatWhen(l.dueDate)}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant={isOpen ? "secondary" : "outline"}
                              type="button"
                              onClick={() =>
                                setExpandedId(isOpen ? null : l.id)
                              }
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              {isOpen ? "Ocultar" : "Ver doc"}
                            </Button>
                            {showApprove && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!busy}
                                  onClick={() => void act(l.id, "approve")}
                                >
                                  <Check className="mr-1 h-3.5 w-3.5" />
                                  Aprobar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!!busy}
                                  onClick={() => void act(l.id, "reject")}
                                >
                                  <X className="mr-1 h-3.5 w-3.5" />
                                  Rechazar
                                </Button>
                              </>
                            )}
                            {canReturn && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!!busy}
                                onClick={() => void act(l.id, "return")}
                              >
                                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                Devolver
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                          <td colSpan={7} className="px-3 py-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-800">
                                Documento solicitado: {l.document.code} —{" "}
                                {l.document.name}
                              </p>
                              <Link
                                href={`/documents/${l.document.id}`}
                                className="text-sm text-blue-700 hover:underline"
                              >
                                Abrir ficha completa
                              </Link>
                            </div>
                            <DocumentFileViewer
                              files={l.document.previewFiles}
                              title="Archivo del documento solicitado"
                              compact
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
