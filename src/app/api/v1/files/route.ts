import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError } from "@/shared/kernel/http";
import { prisma } from "@/shared/kernel/prisma";
import { readUpload } from "@/shared/kernel/storage";

function guessMime(filePath: string, fallback?: string | null) {
  if (fallback) return fallback;
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] ?? "application/octet-stream";
}

function canAccessDoc(
  user: { roleCode: string; organizationId: string; dependencyId: string | null },
  doc: { organizationId: string; dependencyId: string }
) {
  if (doc.organizationId !== user.organizationId) return false;
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN", "CONSULT_USER"].includes(user.roleCode)) {
    return true;
  }
  if (
    (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER") &&
    user.dependencyId
  ) {
    return doc.dependencyId === user.dependencyId;
  }
  return false;
}

/** GET /api/v1/files?type=version|attachment|document&id=xxx&disposition=inline|attachment */
export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.read");

    const type = req.nextUrl.searchParams.get("type");
    const id = req.nextUrl.searchParams.get("id");
    const dispositionParam = req.nextUrl.searchParams.get("disposition") ?? "attachment";
    if (!type || !id) throw new AppError("Parámetros incompletos", 400);

    let filePath: string | null = null;
    let downloadName = "archivo";
    let mimeType: string | null = null;

    if (type === "version") {
      const version = await prisma.documentVersion.findUnique({
        where: { id },
        include: { document: true },
      });
      if (!version?.filePath || !canAccessDoc(user, version.document)) {
        throw new AppError("Archivo no encontrado", 404);
      }
      filePath = version.filePath;
      downloadName = `v${version.version}-${version.document.code}${path.extname(version.filePath)}`;
    } else if (type === "attachment") {
      const att = await prisma.documentAttachment.findUnique({
        where: { id },
        include: { document: true },
      });
      if (!att || !canAccessDoc(user, att.document)) {
        throw new AppError("Archivo no encontrado", 404);
      }
      filePath = att.filePath;
      downloadName = att.name;
      mimeType = att.mimeType;
    } else if (type === "document") {
      const doc = await prisma.document.findFirst({
        where: { id, deletedAt: null },
      });
      if (!doc?.filePath || !canAccessDoc(user, doc)) {
        throw new AppError("Archivo no encontrado", 404);
      }
      filePath = doc.filePath;
      downloadName = `${doc.code}${path.extname(doc.filePath)}`;
    } else {
      throw new AppError("Tipo inválido", 400);
    }

    const buffer = await readUpload(filePath);
    const contentType = guessMime(filePath, mimeType);
    const inline =
      dispositionParam === "inline" &&
      (contentType === "application/pdf" || contentType.startsWith("image/"));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(downloadName)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
