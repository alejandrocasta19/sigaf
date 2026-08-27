import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk } from "@/shared/kernel/http";
import { getDocument } from "@/modules/documents";

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

export async function POST() {
  return jsonError(
    new AppError(
      "Use POST /api/v1/uploads/intent (purpose=attachment), PUT a la URL firmada y POST /api/v1/uploads/complete",
      410
    )
  );
}
