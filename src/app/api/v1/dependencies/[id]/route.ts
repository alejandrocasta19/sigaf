import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { isAdminRole, updateDependency } from "@/modules/identity";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    if (!isAdminRole(user)) throw new AppError("Sin permiso", 403);

    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const dep = await updateDependency(user, id, body);

    await writeAudit({
      user,
      action: "DEPENDENCY_UPDATE",
      module: "identity",
      entityType: "Dependency",
      entityId: dep.id,
      changes: body,
      req,
    });

    return jsonOk(dep);
  } catch (e) {
    return jsonError(e);
  }
}
