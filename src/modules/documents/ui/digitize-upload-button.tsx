"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { directUpload } from "@/shared/ui/direct-upload";

export function DigitizeUploadButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      await directUpload(file, { purpose: "digitize", targetId: documentId });
      toast.success("Documento digitalizado (texto PDF indexado si aplica)");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,image/*"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <Button
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? "Subiendo…" : "Digitalizar"}
      </Button>
    </>
  );
}
