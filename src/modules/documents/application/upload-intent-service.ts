import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import {
  assertUploadIntent,
  sniffMime,
} from "@/shared/kernel/upload-policy";
import {
  buildStorageKey,
  getSignedPutUrl,
  headObject,
  readObjectPrefix,
  type StorageCategory,
} from "@/shared/kernel/storage";
import { addDocumentAttachment, addDocumentVersion, getDocument } from "@/modules/documents/application/documents-service";
import { enqueueJob, JOB_TYPES } from "@/jobs";

export type UploadPurpose = "document" | "attachment" | "version" | "digitize" | "import";

const PURPOSE_CATEGORY: Record<UploadPurpose, StorageCategory> = {
  document: "documents",
  attachment: "attachments",
  version: "versions",
  digitize: "documents",
  import: "imports",
};

const PURPOSE_EXT: Partial<Record<UploadPurpose, string[]>> = {
  digitize: [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"],
  import: [".xlsx", ".xls", ".csv"],
};

export async function createUploadIntent(
  user: SessionUser,
  data: {
    purpose: UploadPurpose;
    fileName: string;
    mimeType?: string;
    sizeBytes: number;
    targetId?: string;
    extra?: Record<string, unknown>;
  }
) {
  const validated = assertUploadIntent(
    { name: data.fileName, type: data.mimeType, size: data.sizeBytes },
    { allowedExt: PURPOSE_EXT[data.purpose] }
  );

  if (data.purpose !== "import") {
    if (!data.targetId) throw new AppError("targetId requerido", 400);
    const doc = await getDocument(user, data.targetId);
    if (!doc) throw new AppError("Documento no encontrado", 404);
  }

  const storageKey = buildStorageKey({
    orgId: user.organizationId,
    category: PURPOSE_CATEGORY[data.purpose],
    originalName: validated.safeOriginalName,
    id: data.targetId,
  });

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const intent = await prisma.uploadIntent.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      storageKey,
      originalName: validated.safeOriginalName,
      mimeType: validated.mimeType,
      sizeBytes: data.sizeBytes,
      purpose: data.purpose,
      targetId: data.targetId,
      extra: data.extra as object | undefined,
      status: "PENDING",
      expiresAt,
    },
  });

  const signed = await getSignedPutUrl({
    storageKey,
    contentType: validated.mimeType,
    maxBytes: validated.maxBytes,
  });

  return { intentId: intent.id, ...signed };
}

export async function completeUploadIntent(user: SessionUser, intentId: string) {
  const intent = await prisma.uploadIntent.findFirst({
    where: { id: intentId, organizationId: user.organizationId, userId: user.id },
  });
  if (!intent) throw new AppError("Intento de subida no encontrado", 404);
  if (intent.status !== "PENDING") throw new AppError("El intento ya fue procesado", 400);
  if (intent.expiresAt < new Date()) throw new AppError("La URL de subida expiró", 400);

  const head = await headObject(intent.storageKey);
  if (!head || head.sizeBytes <= 0) {
    throw new AppError("El archivo no está en el almacenamiento. Suba primero con la URL firmada.", 400);
  }
  if (head.sizeBytes > intent.sizeBytes * 1.05 + 1024) {
    throw new AppError("El tamaño subido no coincide con lo declarado", 400);
  }

  const prefix = await readObjectPrefix(intent.storageKey, 32);
  const detected = sniffMime(prefix);
  if (!detected) throw new AppError("No se pudo determinar el tipo real del archivo", 400);

  const purpose = intent.purpose as UploadPurpose;
  let documentId = intent.targetId ?? undefined;
  let versionId: string | undefined;
  let attachmentId: string | undefined;
  let result: unknown = { storageKey: intent.storageKey };

  if (purpose === "version" && intent.targetId) {
    const version = await addDocumentVersion(user, intent.targetId, {
      relativePath: intent.storageKey,
      hash: "",
      changeNote: (intent.extra as { changeNote?: string } | null)?.changeNote,
    });
    if (!version) throw new AppError("Documento no encontrado", 404);
    versionId = version.id;
    documentId = intent.targetId;
    await prisma.document.update({
      where: { id: intent.targetId },
      data: { fileScanStatus: "PENDING", filePath: intent.storageKey },
    });
    result = version;
  } else if (purpose === "attachment" && intent.targetId) {
    const att = await addDocumentAttachment(user, intent.targetId, {
      name: intent.originalName,
      relativePath: intent.storageKey,
      mimeType: intent.mimeType,
      sizeBytes: head.sizeBytes,
    });
    if (!att) throw new AppError("Documento no encontrado", 404);
    attachmentId = att.id;
    documentId = intent.targetId;
    result = att;
  } else if ((purpose === "digitize" || purpose === "document") && intent.targetId) {
    await prisma.document.update({
      where: { id: intent.targetId },
      data: {
        filePath: intent.storageKey,
        fileScanStatus: "PENDING",
        imageUrl: intent.mimeType.startsWith("image/") ? intent.storageKey : undefined,
      },
    });
    documentId = intent.targetId;
    result = { id: intent.targetId, filePath: intent.storageKey };
  } else if (purpose === "import") {
    const job = await enqueueJob(user, JOB_TYPES.DOCUMENT_IMPORT, {
      storageKey: intent.storageKey,
    });
    await prisma.uploadIntent.update({
      where: { id: intent.id },
      data: { status: "COMPLETED" },
    });
    return { jobId: job.id, status: "queued" };
  }

  await prisma.uploadIntent.update({
    where: { id: intent.id },
    data: { status: "COMPLETED" },
  });

  const job = await enqueueJob(user, JOB_TYPES.FILE_PROCESS, {
    storageKey: intent.storageKey,
    documentId,
    versionId,
    attachmentId,
    mimeType: intent.mimeType,
    originalName: intent.originalName,
  });

  return { data: result, jobId: job.id };
}
