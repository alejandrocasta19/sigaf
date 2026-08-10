import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import { addDocumentAttachment, getDocument } from "@/modules/documents";
import { saveUpload } from "@/shared/kernel/storage";
import { assertAllowedUpload } from "@/shared/kernel/upload-policy";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.read");
    const { id } = await ctx.params;
    const doc = await getDocument(user, id);
    if (!doc) throw new AppError("Documento no encontrado", 404);
    return jsonOk(doc.attachments);
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.update");

    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      throw new AppError("Debe adjuntar un archivo", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = await assertAllowedUpload(file, buffer);

    const saved = await saveUpload({
      orgId: user.organizationId,
      category: "attachments",
      originalName: validated.safeOriginalName,
      buffer,
    });

    const attachment = await addDocumentAttachment(user, id, {
      name: validated.safeOriginalName,
      relativePath: saved.relativePath,
      mimeType: validated.detectedMime,
      sizeBytes: saved.sizeBytes,
    });
    if (!attachment) throw new AppError("Documento no encontrado", 404);

    await writeAudit({
      user,
      action: "DOCUMENT_ATTACHMENT_CREATE",
      module: "documents",
      entityType: "Document",
      entityId: id,
      changes: { name: file.name },
    });

    return jsonOk(attachment, 201);
  } catch (e) {
    if (e instanceof Error && !(e instanceof AppError)) {
      return jsonError(new AppError(e.message, 400));
    }
    return jsonError(e);
  }
}

