import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError } from "@/shared/kernel/http";
import { prisma } from "@/shared/kernel/prisma";
import { getSignedGetUrl } from "@/shared/kernel/storage";

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

/** GET /api/v1/files?type=version|attachment|document|job&id=xxx&disposition=inline|attachment */
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
    const inline = dispositionParam === "inline";

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
    } else if (type === "document") {
      const doc = await prisma.document.findFirst({
        where: { id, deletedAt: null },
      });
      if (!doc?.filePath || !canAccessDoc(user, doc)) {
        throw new AppError("Archivo no encontrado", 404);
      }
      filePath = doc.filePath;
      downloadName = `${doc.code}${path.extname(doc.filePath)}`;
    } else if (type === "job") {
      requirePermission(user, "reports.export");
      const job = await prisma.job.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      const result = job?.result as { storageKey?: string; filename?: string } | null;
      if (!job || job.status !== "COMPLETED" || !result?.storageKey) {
        throw new AppError("Reporte no disponible", 404);
      }
      filePath = result.storageKey;
      downloadName = result.filename || "reporte";
    } else {
      throw new AppError("Tipo inválido", 400);
    }

    const url = await getSignedGetUrl({
      storageKey: filePath,
      downloadName,
      inline,
    });
    return NextResponse.redirect(url, 302);
  } catch (e) {
    return jsonError(e);
  }
}
