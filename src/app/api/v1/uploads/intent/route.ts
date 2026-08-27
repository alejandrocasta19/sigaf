import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk } from "@/shared/kernel/http";
import {
  createUploadIntent,
  type UploadPurpose,
} from "@/modules/documents/application/upload-intent-service";

const intentSchema = z.object({
  purpose: z.enum(["document", "attachment", "version", "digitize", "import"]),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive(),
  targetId: z.string().optional(),
  extra: z
    .object({
      changeNote: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    if (!hasPermission(user, "documents.update") && !hasPermission(user, "documents.create")) {
      throw new AppError("Sin permiso", 403);
    }

    const body = intentSchema.parse(await req.json());
    const signed = await createUploadIntent(user, {
      purpose: body.purpose as UploadPurpose,
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      targetId: body.targetId,
      extra: body.extra,
    });
    return jsonOk(signed, 201);
  } catch (e) {
    return jsonError(e);
  }
}
