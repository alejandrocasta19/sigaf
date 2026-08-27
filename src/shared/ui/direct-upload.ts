"use client";

export type UploadPurpose = "document" | "attachment" | "version" | "digitize" | "import";

async function pollJob(jobId: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`/api/v1/jobs/${jobId}`);
    const json = await res.json();
    const job = json.data;
    if (job?.status === "COMPLETED") return job;
    if (job?.status === "FAILED") throw new Error(job.error || "El trabajo falló");
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("Tiempo de espera agotado. El trabajo sigue en cola.");
}

/** Subida directa al storage: intent → PUT firmado → complete. El binario no pasa por Next.js. */
export async function directUpload(file: File, opts: {
  purpose: UploadPurpose;
  targetId?: string;
  extra?: Record<string, unknown>;
}) {
  const intentRes = await fetch("/api/v1/uploads/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose: opts.purpose,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      targetId: opts.targetId,
      extra: opts.extra,
    }),
  });
  const intentJson = await intentRes.json();
  if (!intentRes.ok) throw new Error(intentJson.error || "No se pudo autorizar la subida");

  const { url, headers, intentId } = intentJson.data as {
    url: string;
    headers: Record<string, string>;
    intentId: string;
  };

  const put = await fetch(url, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!put.ok) throw new Error("Error al enviar el archivo al almacenamiento");

  const completeRes = await fetch("/api/v1/uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intentId }),
  });
  const completeJson = await completeRes.json();
  if (!completeRes.ok) throw new Error(completeJson.error || "No se pudo confirmar la subida");
  return completeJson.data as { data?: unknown; jobId?: string; status?: string };
}

export async function enqueueAndDownloadReport(type: string, format: string) {
  const res = await fetch(`/api/v1/reports?type=${type}&format=${format}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Error al exportar");
  const jobId = json.data.jobId as string;
  const job = await pollJob(jobId);
  window.location.href = `/api/v1/files?type=job&id=${job.id}`;
}

export { pollJob };
