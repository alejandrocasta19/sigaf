import path from "path";
import { spawn } from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { AppError } from "@/shared/kernel/http";

function envMb(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Tope global (MB). Por tipo: UPLOAD_MAX_PDF_MB, UPLOAD_MAX_IMAGE_MB, UPLOAD_MAX_OFFICE_MB. */
export function maxUploadBytesFor(ext: string): number {
  const globalMb = envMb("UPLOAD_MAX_MB", 20);
  const pdfMb = envMb("UPLOAD_MAX_PDF_MB", globalMb);
  const imageMb = envMb("UPLOAD_MAX_IMAGE_MB", Math.min(globalMb, 10));
  const officeMb = envMb("UPLOAD_MAX_OFFICE_MB", globalMb);
  if (ext === ".pdf") return pdfMb * 1024 * 1024;
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return imageMb * 1024 * 1024;
  if ([".doc", ".docx", ".xls", ".xlsx", ".csv"].includes(ext)) return officeMb * 1024 * 1024;
  return globalMb * 1024 * 1024;
}

export const MAX_UPLOAD_BYTES = envMb("UPLOAD_MAX_MB", 20) * 1024 * 1024;

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

/** Extensiones ejecutables / script — rechazar en cualquier segmento del nombre */
const DANGEROUS_EXT = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".ps1",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".jar",
  ".dll",
  ".sh",
  ".bash",
  ".php",
  ".asp",
  ".aspx",
  ".cgi",
  ".htaccess",
  ".html",
  ".htm",
  ".svg",
  ".wsf",
  ".wsh",
  ".lnk",
  ".reg",
  ".pif",
  ".cpl",
]);

const EXT_MIME: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "text/plain", "application/vnd.ms-excel"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
};

export type ValidatedUpload = {
  safeOriginalName: string;
  ext: string;
  detectedMime: string;
};

export type AssertUploadOptions = {
  /** Si se define, solo estas extensiones (p.ej. digitize: pdf/imágenes) */
  allowedExt?: string[];
};

export function assertSafeFilename(originalName: string): { base: string; ext: string } {
  const raw = (originalName || "").trim();
  if (!raw) throw new AppError("Nombre de archivo vacío", 400);
  if (raw.length > 180) throw new AppError("Nombre de archivo demasiado largo", 400);

  const base = path.basename(raw.replace(/\\/g, "/"));
  if (!base || base === "." || base === "..") {
    throw new AppError("Nombre de archivo inválido", 400);
  }
  if (/[\0\x00-\x1f<>:"|?*]/.test(base)) {
    throw new AppError("El nombre del archivo contiene caracteres no permitidos", 400);
  }

  const parts = base.split(".").filter((p) => p.length > 0);
  if (parts.length < 2) {
    throw new AppError("El archivo debe tener una extensión válida", 400);
  }

  const suffixes = parts.slice(1).map((s) => `.${s.toLowerCase()}`);
  for (const s of suffixes) {
    if (DANGEROUS_EXT.has(s)) {
      throw new AppError(
        `Extensión peligrosa detectada (${s}). Ejemplo rechazado: archivo.pdf.exe`,
        400
      );
    }
  }

  if (suffixes.length > 1) {
    // Doble extensión no peligrosa (p.ej. informe.final.pdf) se permite solo si
    // el último segmento está en allowlist; los intermedios no pueden ser peligrosos
    // (ya filtrados). Más de 2 sufijos → rechazo para reducir engaños.
    if (suffixes.length > 2) {
      throw new AppError(
        "Nombre con múltiples extensiones no permitido. Use un solo tipo (p.ej. documento.pdf)",
        400
      );
    }
  }

  const ext = suffixes[suffixes.length - 1];
  if (!ALLOWED_EXT.has(ext)) {
    throw new AppError(
      `Tipo de archivo no permitido (${ext}). Use: ${[...ALLOWED_EXT].join(", ")}`,
      400
    );
  }

  const stem = parts[0]
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
  if (!stem) throw new AppError("Nombre de archivo inválido", 400);

  return { base: `${stem}${ext}`, ext };
}

/** Validación previa a firmar URL (sin leer el binario). */
export function assertUploadIntent(
  file: { name: string; type?: string; size: number },
  opts: AssertUploadOptions = {}
): { safeOriginalName: string; ext: string; maxBytes: number; mimeType: string } {
  if (!file.size || file.size <= 0) throw new AppError("Archivo vacío", 400);
  const { base, ext } = assertSafeFilename(file.name);
  if (opts.allowedExt?.length && !opts.allowedExt.map((e) => e.toLowerCase()).includes(ext)) {
    throw new AppError(
      `Tipo no permitido para esta operación (${ext}). Use: ${opts.allowedExt.join(", ")}`,
      400
    );
  }
  const maxBytes = maxUploadBytesFor(ext);
  if (file.size > maxBytes) {
    throw new AppError(
      `El archivo supera el máximo de ${Math.round(maxBytes / (1024 * 1024))} MB`,
      400
    );
  }
  const allowedMimes = EXT_MIME[ext] ?? [];
  const clientMime = (file.type || "").toLowerCase();
  const mimeType = allowedMimes[0] || clientMime || "application/octet-stream";
  if (
    clientMime &&
    clientMime !== "application/octet-stream" &&
    allowedMimes.length &&
    !allowedMimes.some((m) => clientMime === m || clientMime.startsWith(m.split("/")[0] + "/")) &&
    !(ext === ".csv" && (clientMime === "text/plain" || clientMime.includes("csv")))
  ) {
    if (clientMime.includes("javascript") || clientMime.includes("executable")) {
      throw new AppError(`MIME no permitido: ${clientMime}`, 400);
    }
  }
  return { safeOriginalName: base, ext, maxBytes, mimeType };
}

export function sniffMime(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.length >= 6) {
    const g = buffer.subarray(0, 6).toString("ascii");
    if (g === "GIF87a" || g === "GIF89a") return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  // OOXML / ZIP (docx, xlsx)
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return "application/zip";
  }
  // OLE Compound (doc/xls antiguos)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return "application/msword";
  }
  // Texto/CSV: printable-ish
  if (buffer.length > 0) {
    const sample = buffer.subarray(0, Math.min(512, buffer.length));
    let printable = 0;
    for (const b of sample) {
      if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 160) printable += 1;
    }
    if (printable / sample.length > 0.9) return "text/plain";
  }
  return null;
}

function mimeCompatible(ext: string, detected: string, clientMime?: string): boolean {
  const allowed = EXT_MIME[ext] || [];
  if (allowed.some((m) => detected === m || detected.startsWith(m.replace(/\/.*/, "/")))) {
    return true;
  }
  if (allowed.includes(detected)) return true;
  // text/csv detectado como text/plain
  if ((ext === ".csv" || ext === ".txt") && detected === "text/plain") return true;
  if (ext === ".doc" && detected === "application/msword") return true;
  if ((ext === ".xls" || ext === ".doc") && detected === "application/msword") return true;
  // Cliente solo como pista secundaria
  const cm = (clientMime || "").toLowerCase();
  if (cm && allowed.some((m) => cm === m || cm.startsWith(m.split("/")[0] + "/"))) {
    // Si el magic no cuadra, no confiar solo en el cliente
    return false;
  }
  return allowed.includes(detected);
}

export async function scanWithClamAv(buffer: Buffer, safeName: string) {
  if (process.env.CLAMAV_ENABLED !== "true") return;
  const bin = process.env.CLAMAV_BIN || "clamdscan";
  const dir = await mkdtemp(path.join(tmpdir(), "sigaf-up-"));
  const filePath = path.join(dir, safeName);
  try {
    await writeFile(filePath, buffer);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(bin, ["--no-summary", filePath], { windowsHide: true });
      let stderr = "";
      child.stderr.on("data", (d) => {
        stderr += String(d);
      });
      child.on("error", (err) => {
        reject(
          new AppError(
            `Antivirus no disponible (${bin}). Configure CLAMAV o desactive CLAMAV_ENABLED.`,
            503
          )
        );
        void err;
      });
      child.on("close", (code) => {
        if (code === 0) resolve();
        else if (code === 1) reject(new AppError("Archivo rechazado por antivirus", 400));
        else reject(new AppError(`Error antivirus (${code}): ${stderr || bin}`, 503));
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Valida tamaño, nombre, doble extensión, magic bytes y (opcional) ClamAV.
 */
export async function assertAllowedUpload(
  file: { name: string; type?: string },
  buffer: Buffer,
  opts: AssertUploadOptions = {}
): Promise<ValidatedUpload> {
  if (buffer.byteLength <= 0) throw new AppError("Archivo vacío", 400);
  const { base, ext } = assertSafeFilename(file.name);
  const maxBytes = maxUploadBytesFor(ext);
  if (buffer.byteLength > maxBytes) {
    throw new AppError(
      `El archivo supera el máximo de ${Math.round(maxBytes / (1024 * 1024))} MB`,
      400
    );
  }
  if (opts.allowedExt?.length && !opts.allowedExt.map((e) => e.toLowerCase()).includes(ext)) {
    throw new AppError(
      `Tipo no permitido para esta operación (${ext}). Use: ${opts.allowedExt.join(", ")}`,
      400
    );
  }

  const detected = sniffMime(buffer);
  if (!detected) {
    throw new AppError("No se pudo determinar el tipo real del archivo", 400);
  }
  if (!mimeCompatible(ext, detected, file.type)) {
    throw new AppError(
      `El contenido del archivo no coincide con la extensión ${ext} (detectado: ${detected})`,
      400
    );
  }

  const clientMime = (file.type || "").toLowerCase();
  if (
    clientMime &&
    clientMime !== "application/octet-stream" &&
    !EXT_MIME[ext]?.some(
      (m) => clientMime === m || clientMime.startsWith(m.split("/")[0] + "/")
    ) &&
    !(ext === ".csv" && (clientMime === "text/plain" || clientMime.includes("csv")))
  ) {
    // Pista del navegador inconsistente: no bloquear si magic OK, solo si es claramente peligroso
    if (clientMime.includes("javascript") || clientMime.includes("executable")) {
      throw new AppError(`MIME no permitido: ${clientMime}`, 400);
    }
  }

  await scanWithClamAv(buffer, base);

  return {
    safeOriginalName: base,
    ext,
    detectedMime: detected === "application/zip" && (ext === ".docx" || ext === ".xlsx")
      ? EXT_MIME[ext]![0]
      : detected,
  };
}
