import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { deleteRole, isAdminRole, updateRole } from "@/modules/identity";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  accessLevel: z.number().int().min(0).max(100).optional(),
  permissionIds: z.array(z.string()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode)) {
      throw new AppError("Acceso denegado", 403);
    }

    const { id } = await ctx.params;
    const body = updateSchema.parse(await req.json());
    const updated = await updateRole(id, body);

    await writeAudit({
      user,
      action: "ROLE_UPDATE",
      module: "identity",
      entityType: "Role",
      entityId: id,
      changes: body,
    });

    return jsonOk(updated);
  } catch (e) {
    if (e instanceof Error && !(e instanceof AppError) && e.name !== "ZodError") {
      return jsonError(new AppError(e.message, 400));
    }
    return jsonError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    if (user.roleCode !== "SUPER_ADMIN") {
      throw new AppError("Solo el Super Administrador puede eliminar roles", 403);
    }

    const { id } = await ctx.params;
    const deleted = await deleteRole(id);

    await writeAudit({
      user,
      action: "ROLE_DELETE",
      module: "identity",
      entityType: "Role",
      entityId: id,
      changes: { code: deleted.code, name: deleted.name },
    });

    return jsonOk({ deleted: true, id });
  } catch (e) {
    if (e instanceof Error && !(e instanceof AppError)) {
      return jsonError(new AppError(e.message, 400));
    }
    return jsonError(e);
  }
}
