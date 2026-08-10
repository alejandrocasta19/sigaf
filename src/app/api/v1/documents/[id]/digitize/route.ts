import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import { digitizeDocument } from "@/modules/documents/application/digitize-service";
import { assertAllowedUpload } from "@/shared/kernel/upload-policy";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.update");
    const { id } = await ctx.params;

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) throw new AppError("Adjunte un archivo", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = await assertAllowedUpload(file, buffer, {
      allowedExt: [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"],
    });

    const doc = await digitizeDocument(user, id, {
      originalName: validated.safeOriginalName,
      buffer,
      mimeType: validated.detectedMime,
    });

    await writeAudit({
      user,
      action: "DOCUMENT_DIGITIZE",
      module: "documents",
      entityType: "Document",
      entityId: id,
      changes: { filePath: doc.filePath, fileHash: doc.fileHash },
      req,
    });

    return jsonOk(doc);
  } catch (e) {
    return jsonError(e);
  }
}
