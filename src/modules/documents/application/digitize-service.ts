import { createHash } from "crypto";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { saveUpload, hashBuffer } from "@/shared/kernel/storage";
import { documentScope, buildSearchText } from "@/modules/documents/application/documents-service";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return (data.text || "").replace(/\s+/g, " ").trim().slice(0, 20000);
  } catch {
    return "";
  }
}

export async function digitizeDocument(
  user: SessionUser,
  documentId: string,
  file: { originalName: string; buffer: Buffer; mimeType?: string }
) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...documentScope(user) },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);

  const saved = await saveUpload({
    orgId: user.organizationId,
    category: "documents",
    originalName: file.originalName,
    buffer: file.buffer,
  });

  let ocrText = "";
  if (
    file.mimeType?.includes("pdf") ||
    file.originalName.toLowerCase().endsWith(".pdf")
  ) {
    ocrText = await extractPdfText(file.buffer);
  }

  const searchText = buildSearchText({
    name: doc.name,
    code: doc.code,
    observations: [doc.observations, ocrText].filter(Boolean).join(" "),
  });

  return prisma.document.update({
    where: { id: doc.id },
    data: {
      filePath: saved.relativePath,
      fileHash: saved.hash,
      imageUrl: file.mimeType?.startsWith("image/") ? saved.relativePath : doc.imageUrl,
      searchText,
    },
  });
}

export async function signDocument(
  user: SessionUser,
  documentId: string,
  signerName?: string
) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...documentScope(user) },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);
  if (!doc.filePath && !doc.fileHash) {
    throw new AppError("El documento no tiene archivo digital para firmar", 400);
  }

  const payload = `${doc.id}|${doc.fileHash || doc.filePath}|${user.id}|${Date.now()}`;
  const hash = createHash("sha256").update(payload).digest("hex");
  const signatureData = Buffer.from(
    JSON.stringify({
      signerId: user.id,
      signerEmail: user.email,
      at: new Date().toISOString(),
      fileHash: doc.fileHash,
    })
  ).toString("base64");

  return prisma.digitalSignature.create({
    data: {
      documentId: doc.id,
      signerName: signerName || user.fullName || user.email,
      signatureData,
      hash,
    },
  });
}

export async function listSignatures(user: SessionUser, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...documentScope(user) },
    select: { id: true },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);
  return prisma.digitalSignature.findMany({
    where: { documentId },
    orderBy: { signedAt: "desc" },
  });
}

export { hashBuffer };
