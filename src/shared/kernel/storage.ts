import { createHash, createHmac, randomBytes } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, writeFile, readFile, stat, unlink } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import type { Readable } from "stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || "./uploads");

export type StorageCategory =
  | "documents"
  | "attachments"
  | "versions"
  | "imports"
  | "backups"
  | "signatures"
  | "instruments"
  | "reports"
  | "thumbnails";

export type SignedPut = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  storageKey: string;
  expiresIn: number;
};

let s3: S3Client | null = null;

function driver(): "local" | "s3" {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
}

function s3Client() {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
      },
    });
  }
  return s3;
}

function bucket() {
  return process.env.S3_BUCKET || "sigaf-docs";
}

function signSecret() {
  return process.env.JWT_SECRET || process.env.CSRF_SECRET || "sigaf-storage-dev";
}

export function buildStorageKey(params: {
  orgId: string;
  category: StorageCategory;
  originalName: string;
  id?: string;
}) {
  const ext = path.extname(params.originalName) || "";
  const safeBase = path
    .basename(params.originalName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60);
  const stamp = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const idPart = params.id ? `${params.id}/` : "";
  return `${params.orgId}/${params.category}/${idPart}${stamp}-${safeBase}${ext}`.replace(/\\/g, "/");
}

export async function ensureUploadDir(...parts: string[]) {
  const dir = path.join(UPLOAD_ROOT, ...parts);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function hashBuffer(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

export function resolveUploadPath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("..")) throw new Error("Ruta inválida");
  return path.join(UPLOAD_ROOT, normalized);
}

function encodeLocalToken(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signSecret()).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function decodeLocalToken(token: string): {
  key: string;
  op: "put" | "get";
  exp: number;
  maxBytes?: number;
  contentType?: string;
  downloadName?: string;
} | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signSecret()).update(body).digest("hex");
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.key || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSignedPutUrl(params: {
  storageKey: string;
  contentType: string;
  maxBytes: number;
  expiresIn?: number;
}): Promise<SignedPut> {
  const expiresIn = params.expiresIn ?? 300;
  if (driver() === "s3") {
    const url = await getSignedUrl(
      s3Client(),
      new PutObjectCommand({
        Bucket: bucket(),
        Key: params.storageKey,
        ContentType: params.contentType,
      }),
      { expiresIn }
    );
    return {
      url,
      method: "PUT",
      headers: { "Content-Type": params.contentType },
      storageKey: params.storageKey,
      expiresIn,
    };
  }

  const token = encodeLocalToken({
    key: params.storageKey,
    op: "put",
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    maxBytes: params.maxBytes,
    contentType: params.contentType,
  });
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return {
    url: `${appUrl}/api/v1/uploads/stream?token=${token}`,
    method: "PUT",
    headers: { "Content-Type": params.contentType },
    storageKey: params.storageKey,
    expiresIn,
  };
}

export async function getSignedGetUrl(params: {
  storageKey: string;
  downloadName?: string;
  expiresIn?: number;
  inline?: boolean;
}) {
  const expiresIn = params.expiresIn ?? 120;
  if (driver() === "s3") {
    const url = await getSignedUrl(
      s3Client(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: params.storageKey,
        ResponseContentDisposition: `${params.inline ? "inline" : "attachment"}; filename="${encodeURIComponent(params.downloadName || "archivo")}"`,
      }),
      { expiresIn }
    );
    return url;
  }
  const token = encodeLocalToken({
    key: params.storageKey,
    op: "get",
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    downloadName: params.downloadName,
  });
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/v1/uploads/stream?token=${token}&disposition=${params.inline ? "inline" : "attachment"}`;
}

export async function headObject(storageKey: string): Promise<{ sizeBytes: number; contentType?: string } | null> {
  if (driver() === "s3") {
    try {
      const out = await s3Client().send(
        new HeadObjectCommand({ Bucket: bucket(), Key: storageKey })
      );
      return {
        sizeBytes: out.ContentLength ?? 0,
        contentType: out.ContentType,
      };
    } catch {
      return null;
    }
  }
  try {
    const s = await stat(resolveUploadPath(storageKey));
    return { sizeBytes: s.size };
  } catch {
    return null;
  }
}

export async function deleteObject(storageKey: string) {
  if (driver() === "s3") {
    await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }));
    return;
  }
  await unlink(resolveUploadPath(storageKey)).catch(() => undefined);
}

export async function putObject(params: {
  storageKey: string;
  buffer: Buffer;
  contentType?: string;
}) {
  if (driver() === "s3") {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: params.storageKey,
        Body: params.buffer,
        ContentType: params.contentType,
      })
    );
    return { relativePath: params.storageKey, sizeBytes: params.buffer.length, hash: hashBuffer(params.buffer) };
  }
  const absolute = resolveUploadPath(params.storageKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, params.buffer);
  return { relativePath: params.storageKey, sizeBytes: params.buffer.length, hash: hashBuffer(params.buffer) };
}

export async function writeLocalStream(storageKey: string, body: Readable, maxBytes: number) {
  const absolute = resolveUploadPath(storageKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  let written = 0;
  const dest = createWriteStream(absolute);
  body.on("data", (chunk: Buffer) => {
    written += chunk.length;
    if (written > maxBytes) {
      body.destroy(new Error("Archivo supera el tamaño máximo"));
    }
  });
  await pipeline(body, dest);
  return { sizeBytes: written };
}

export async function hashObject(storageKey: string): Promise<{ hash: string; sizeBytes: number }> {
  const hash = createHash("sha256");
  let sizeBytes = 0;

  const consume = (body: Readable) =>
    new Promise<void>((resolve, reject) => {
      body.on("data", (c: Buffer) => {
        sizeBytes += c.length;
        hash.update(c);
      });
      body.on("end", () => resolve());
      body.on("error", reject);
    });

  if (driver() === "s3") {
    const out = await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: storageKey }));
    await consume(out.Body as Readable);
  } else {
    await consume(createReadStream(resolveUploadPath(storageKey)));
  }
  return { hash: hash.digest("hex"), sizeBytes };
}

export async function readObjectPrefix(storageKey: string, bytes = 64): Promise<Buffer> {
  const buf = await readUpload(storageKey);
  return buf.subarray(0, bytes);
}

/** Generación interna (FUID PDF, backups). No usar para subidas de usuario. */
export async function saveUpload(params: {
  orgId: string;
  category: StorageCategory;
  originalName: string;
  buffer: Buffer;
  contentType?: string;
}) {
  const storageKey = buildStorageKey({
    orgId: params.orgId,
    category: params.category,
    originalName: params.originalName,
  });
  const saved = await putObject({
    storageKey,
    buffer: params.buffer,
    contentType: params.contentType,
  });
  return {
    relativePath: saved.relativePath,
    absolutePath: resolveUploadPath(saved.relativePath),
    hash: saved.hash,
    sizeBytes: saved.sizeBytes,
    filename: path.basename(saved.relativePath),
  };
}

export async function readUpload(relativePath: string) {
  if (driver() === "s3") {
    const out = await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: relativePath }));
    const chunks: Buffer[] = [];
    const body = out.Body as Readable;
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return readFile(resolveUploadPath(relativePath));
}

export function createLocalReadStream(relativePath: string) {
  return createReadStream(resolveUploadPath(relativePath));
}

export function storagePublicOrigin() {
  return process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || "";
}
