import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { getDocument, updateDocument, softDeleteDocument } from "@/modules/documents";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  // status solo vía workflow — evita mass assignment
  folioCount: z.number().int().min(1).optional(),
  observations: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.read");

    const { id } = await ctx.params;
    const doc = await getDocument(user, id);
    if (!doc) throw new AppError("Documento no encontrado", 404);

    return jsonOk(doc);
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.update");

    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const doc = await updateDocument(user, id, body);
    if (!doc) throw new AppError("Documento no encontrado", 404);

    await writeAudit({
      user,
      action: "DOCUMENT_UPDATE",
      module: "documents",
      entityType: "Document",
      entityId: id,
      changes: body,
    });

    return jsonOk(doc);
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.delete");

    const { id } = await ctx.params;
    const doc = await softDeleteDocument(user, id);
    if (!doc) throw new AppError("Documento no encontrado", 404);

    await writeAudit({
      user,
      action: "DOCUMENT_DELETE",
      module: "documents",
      entityType: "Document",
      entityId: id,
    });

    return jsonOk({ id, deleted: true });
  } catch (e) {
    return jsonError(e);
  }
}
