import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import {
  decodeLocalToken,
  writeLocalStream,
  createLocalReadStream,
  resolveUploadPath,
} from "@/shared/kernel/storage";
import { jsonError, AppError } from "@/shared/kernel/http";
import { stat } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

function guessMime(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return map[ext] ?? "application/octet-stream";
}

/** PUT/GET local firmado (HMAC). No usa sesión: el token es la autorización. */
export async function PUT(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const payload = token ? decodeLocalToken(token) : null;
    if (!payload || payload.op !== "put") throw new AppError("Token inválido o expirado", 403);

    const maxBytes = payload.maxBytes ?? 20 * 1024 * 1024;
    const nodeReadable = Readable.fromWeb(req.body as import("stream/web").ReadableStream);
    await writeLocalStream(payload.key, nodeReadable, maxBytes);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return jsonError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const payload = token ? decodeLocalToken(token) : null;
    if (!payload || payload.op !== "get") throw new AppError("Token inválido o expirado", 403);

    const absolute = resolveUploadPath(payload.key);
    const s = await stat(absolute);
    const disposition = req.nextUrl.searchParams.get("disposition") ?? "attachment";
    const name = payload.downloadName || path.basename(payload.key);
    const stream = createLocalReadStream(payload.key);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": guessMime(payload.key),
        "Content-Length": String(s.size),
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(name)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
