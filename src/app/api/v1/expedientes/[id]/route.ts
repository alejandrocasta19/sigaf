import { NextRequest } from "next/server";
import { z } from "zod";
import { DocumentStatus } from "@prisma/client";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { getExpediente, updateExpediente, softDeleteExpediente } from "@/modules/expedientes";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
  version: z.number().int().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "expedientes.read");

    const { id } = await ctx.params;
    const exp = await getExpediente(user, id);
    if (!exp) throw new AppError("Expediente no encontrado", 404);

    return jsonOk(exp);
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "expedientes.update");

    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const { version, ...fields } = body;
    const exp = await updateExpediente(user, id, fields, version);
    if (!exp) throw new AppError("Expediente no encontrado", 404);

    await writeAudit({
      user,
      action: "EXPEDIENTE_UPDATE",
      module: "expedientes",
      entityType: "Expediente",
      entityId: id,
      changes: body,
      req,
    });

    return jsonOk(exp);
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "expedientes.delete");

    const { id } = await ctx.params;
    const exp = await softDeleteExpediente(user, id);
    if (!exp) throw new AppError("Expediente no encontrado", 404);

    await writeAudit({
      user,
      action: "EXPEDIENTE_DELETE",
      module: "expedientes",
      entityType: "Expediente",
      entityId: id,
      req,
    });

    return jsonOk({ id, deleted: true });
  } catch (e) {
    return jsonError(e);
  }
}
