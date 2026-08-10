"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenLine } from "lucide-react";
import { Button } from "@/shared/ui/button";

export function SignDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sign() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Firma registrada (hash SHA-256)");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={sign}>
      <PenLine className="h-3.5 w-3.5" />
      {busy ? "Firmando…" : "Firmar"}
    </Button>
  );
}
