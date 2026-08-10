import path from "path";
import { AppError } from "@/shared/kernel/http";

/** 20 MB */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".txt",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
]);

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument",
  "application/octet-stream", // algunos navegadores envían esto; validamos por extensión
];

export function assertAllowedUpload(file: { name: string; type?: string }, buffer: Buffer) {
  if (buffer.byteLength <= 0) {
    throw new AppError("Archivo vacío", 400);
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError(`El archivo supera el máximo de ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`, 400);
  }

  const ext = path.extname(file.name || "").toLowerCase();
  if (!ext || !ALLOWED_EXT.has(ext)) {
    throw new AppError(
      `Tipo de archivo no permitido (${ext || "sin extensión"}). Use: ${[...ALLOWED_EXT].join(", ")}`,
      400
    );
  }

  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    throw new AppError(`MIME no permitido: ${mime}`, 400);
  }
}
