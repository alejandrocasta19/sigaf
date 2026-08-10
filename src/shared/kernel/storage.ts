import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || "./uploads");

export async function ensureUploadDir(...parts: string[]) {
  const dir = path.join(UPLOAD_ROOT, ...parts);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function hashBuffer(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

export async function saveUpload(params: {
  orgId: string;
  category:
    | "documents"
    | "attachments"
    | "versions"
    | "imports"
    | "backups"
    | "signatures"
    | "instruments";
  originalName: string;
  buffer: Buffer;
}) {
  const ext = path.extname(params.originalName) || "";
  const safeBase = path
    .basename(params.originalName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60);
  const filename = `${Date.now()}-${randomBytes(4).toString("hex")}-${safeBase}${ext}`;
  const dir = await ensureUploadDir(params.orgId, params.category);
  const absolute = path.join(dir, filename);
  await writeFile(absolute, params.buffer);
  const relative = path.join(params.orgId, params.category, filename).replace(/\\/g, "/");
  return {
    relativePath: relative,
    absolutePath: absolute,
    hash: hashBuffer(params.buffer),
    sizeBytes: params.buffer.length,
    filename,
  };
}

export function resolveUploadPath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("..")) throw new Error("Ruta inválida");
  return path.join(UPLOAD_ROOT, normalized);
}

export async function readUpload(relativePath: string) {
  return readFile(resolveUploadPath(relativePath));
}
