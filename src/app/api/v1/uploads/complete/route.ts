import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import { completeUploadIntent } from "@/modules/documents/application/upload-intent-service";

const schema = z.object({
  intentId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    if (!hasPermission(user, "documents.update") && !hasPermission(user, "documents.create")) {
      throw new AppError("Sin permiso", 403);
    }

    const body = schema.parse(await req.json());
    const result = await completeUploadIntent(user, body.intentId);

    await writeAudit({
      user,
      action: "UPLOAD_COMPLETE",
      module: "documents",
      entityType: "UploadIntent",
      entityId: body.intentId,
      req,
    });

    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
