"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Check, X, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/input";
import {
  documentStatusLabel,
  documentStatusVariant,
  StatusBadge,
} from "@/shared/list/status-labels";
import {
  DocumentFileViewer,
  buildPreviewFiles,
} from "@/modules/documents/ui/document-file-viewer";
import type { DocumentStatus } from "@prisma/client";

type InboxItem = {
  id: string;
  code: string;
  name: string;
  status: DocumentStatus;
  workflowNotes: string | null;
  filePath: string | null;
  submittedAt: string | Date | null;
  dependency: { name: string };
  submittedBy: { firstName: string; lastName: string } | null;
  documentType: { name: string } | null;
  series: { name: string } | null;
  versions?: Array<{ id: string; version: number; filePath: string | null }>;
  attachments?: Array<{
    id: string;
    name: string;
    filePath: string;
    mimeType: string | null;
  }>;
};

type Mode = "dept" | "archive" | "worker";

export function WorkflowInbox({
  items,
  mode,
}: {
  items: InboxItem[];
  mode: Mode;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(
    items[0]?.id ?? null
  );

  async function run(documentId: string, action: string, requireNotes = false) {
    const observations = notes[documentId]?.trim() ?? "";
    if (requireNotes && !observations) {
      toast.error("Indique observaciones");
      return;
    }
    setBusy(`${documentId}:${action}`);
    try {
      const res = await fetch("/api/v1/documents/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, documentId, observations }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error en el flujo");
      toast.success("Acción registrada");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No hay documentos en esta bandeja.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((doc) => {
        const files = buildPreviewFiles(doc);
        const isOpen = expanded === doc.id;

        return (
          <div
            key={doc.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {doc.code}
                  </Link>
                  <StatusBadge
                    label={documentStatusLabel(doc.status)}
                    variant={documentStatusVariant(doc.status)}
                  />
                </div>
                <p className="mt-1 text-sm text-slate-700">{doc.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {doc.dependency.name}
                  {doc.series ? ` · ${doc.series.name}` : ""}
                  {doc.documentType ? ` · ${doc.documentType.name}` : ""}
                  {doc.submittedBy
                    ? ` · ${doc.submittedBy.firstName} ${doc.submittedBy.lastName}`
                    : ""}
                </p>
                {doc.workflowNotes && (
                  <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    Observaciones: {doc.workflowNotes}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : doc.id)}
                >
                  <Eye className="h-4 w-4" />
                  {isOpen ? "Ocultar archivo" : "Revisar archivo"}
                </Button>
                <Link
                  href={`/documents/${doc.id}`}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-medium text-blue-700 hover:bg-slate-50"
                >
                  Ficha completa
                </Link>
              </div>
            </div>

            {isOpen && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <DocumentFileViewer
                  files={files}
                  title="Rectifique la información del archivo"
                />
              </div>
            )}

            {(mode === "dept" || mode === "archive" || mode === "worker") && (
              <div className="mt-3 space-y-2">
                {(mode === "dept" || mode === "archive") && (
                  <>
                    <Label htmlFor={`notes-${doc.id}`}>Observaciones</Label>
                    <textarea
                      id={`notes-${doc.id}`}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={2}
                      value={notes[doc.id] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [doc.id]: e.target.value }))
                      }
                      placeholder={
                        mode === "dept"
                          ? "Comentarios al funcionario o a Gestión Documental"
                          : "Hallazgos de TRD/TVD/CCD, metadatos, ubicación…"
                      }
                    />
                  </>
                )}

                <div className="flex flex-wrap gap-2">
                  {mode === "dept" && (
                    <>
                      <Button
                        size="sm"
                        disabled={!!busy}
                        onClick={() => run(doc.id, "approve_dept")}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="mr-1 h-4 w-4" /> Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!busy}
                        onClick={() => run(doc.id, "reject_dept", true)}
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <X className="mr-1 h-4 w-4" /> Rechazar
                      </Button>
                    </>
                  )}
                  {mode === "archive" && (
                    <>
                      <Button
                        size="sm"
                        disabled={!!busy}
                        onClick={() => run(doc.id, "approve_archive")}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="mr-1 h-4 w-4" /> Validar e incorporar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!busy}
                        onClick={() => run(doc.id, "reject_archive", true)}
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <X className="mr-1 h-4 w-4" /> Devolver al Jefe
                      </Button>
                    </>
                  )}
                  {mode === "worker" && doc.status === "REJECTED_DEPT" && (
                    <Button
                      size="sm"
                      disabled={!!busy}
                      onClick={() => run(doc.id, "resubmit")}
                    >
                      <RotateCcw className="mr-1 h-4 w-4" /> Reenviar tras corrección
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
