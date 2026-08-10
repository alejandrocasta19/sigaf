"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";

export function RunBackupButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "system.backup" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success(`Backup ${json.data.status}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button disabled={busy} onClick={run}>
      {busy ? "Ejecutando…" : "Crear backup ahora"}
    </Button>
  );
}
