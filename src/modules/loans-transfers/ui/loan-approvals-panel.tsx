"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Eye } from "lucide-react";
import { Button } from "@/shared/ui/button";
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

type PendingLoan = {
  id: string;
  code: string;
  status: LoanStatus;
  requestedAt: string;
  document: {
    id: string;
    name: string;
    code: string;
    previewFiles: PreviewFile[];
  };
  requester: { firstName: string; lastName: string };
};

export function LoanApprovalsPanel({ loans }: { loans: PendingLoan[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(`${id}:${action}`);
    try {
      const res = await fetch(`/api/v1/loans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success(action === "approve" ? "Préstamo aprobado (24h)" : "Préstamo rechazado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  if (loans.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        No hay solicitudes de préstamo pendientes.
      </p>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-xs text-slate-500">
          <th className="pb-3 font-medium">Código</th>
          <th className="pb-3 font-medium">Documento</th>
          <th className="pb-3 font-medium">Solicitante</th>
          <th className="pb-3 font-medium">Estado</th>
          <th className="pb-3 font-medium">Fecha</th>
          <th className="pb-3 font-medium">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {loans.map((l) => {
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
                <td className="py-3">
                  {l.requester.firstName} {l.requester.lastName}
                </td>
                <td className="py-3">
                  <StatusBadge
                    label={loanStatusLabel(l.status)}
                    variant={loanStatusVariant(l.status)}
                  />
                </td>
                <td className="py-3 text-slate-500">
                  {new Date(l.requestedAt).toLocaleString("es-CO")}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant={isOpen ? "secondary" : "outline"}
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : l.id)}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      {isOpen ? "Ocultar" : "Ver doc"}
                    </Button>
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
                  </div>
                </td>
              </tr>
              {isOpen && (
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <td colSpan={6} className="px-3 py-4">
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
  );
}
