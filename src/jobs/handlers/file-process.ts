import { prisma } from "@/shared/kernel/prisma";
import { hashObject, readObjectPrefix, readUpload } from "@/shared/kernel/storage";
import { sniffMime, scanWithClamAv } from "@/shared/kernel/upload-policy";
import { extractPdfText } from "@/modules/documents/application/digitize-service";
import { buildSearchText } from "@/modules/documents/application/documents-service";

type Payload = {
  storageKey?: string;
  documentId?: string;
  attachmentId?: string;
  versionId?: string;
  mimeType?: string;
  originalName?: string;
};

export async function runFileProcessJob(
  payload: unknown,
  _ctx: { organizationId: string; userId?: string }
) {
  const p = (payload ?? {}) as Payload;
  if (!p.storageKey) throw new Error("storageKey requerido");

  const prefix = await readObjectPrefix(p.storageKey, 32);
  const detected = sniffMime(prefix);
  if (!detected) {
    await markRejected(p, "No se pudo determinar el tipo real del archivo");
    return { status: "REJECTED", reason: "mime" };
  }

  if (process.env.CLAMAV_ENABLED === "true") {
    const buf = await readUpload(p.storageKey);
    const name = p.originalName || "archivo.bin";
    await scanWithClamAv(buf, name);
  }

  const { hash, sizeBytes } = await hashObject(p.storageKey);
  let ocrText = "";
  const name = p.originalName || "";
  if (detected === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    const buf = await readUpload(p.storageKey);
    ocrText = await extractPdfText(buf);
  }

  if (p.documentId) {
    const doc = await prisma.document.findUnique({ where: { id: p.documentId } });
    if (doc) {
      const searchText = buildSearchText({
        name: doc.name,
        code: doc.code,
        observations: [doc.observations, ocrText].filter(Boolean).join(" "),
      });
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          fileHash: hash,
          fileScanStatus: "READY",
          searchText,
          imageUrl: detected.startsWith("image/") ? p.storageKey : doc.imageUrl,
        },
      });
    }
  }

  if (p.versionId) {
    await prisma.documentVersion.update({
      where: { id: p.versionId },
      data: { fileHash: hash },
    });
  }

  if (p.attachmentId) {
    await prisma.documentAttachment.update({
      where: { id: p.attachmentId },
      data: { sizeBytes },
    });
  }

  return { status: "READY", hash, sizeBytes, ocrChars: ocrText.length };
}

async function markRejected(p: Payload, reason: string) {
  if (p.documentId) {
    await prisma.document.update({
      where: { id: p.documentId },
      data: { fileScanStatus: "REJECTED" },
    });
  }
  throw new Error(reason);
}
