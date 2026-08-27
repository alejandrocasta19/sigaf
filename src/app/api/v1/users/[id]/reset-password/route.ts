import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { resetUserPassword } from "@/modules/identity";
import { assertPasswordPolicy } from "@/shared/kernel/password-policy";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  password: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "users.update");

    const { id } = await ctx.params;
    const body = schema.parse(await req.json().catch(() => ({})));
    if (body.password) assertPasswordPolicy(body.password);
    const result = await resetUserPassword(user, id, body.password);

    await writeAudit({
      user,
      action: "USER_PASSWORD_RESET",
      module: "identity",
      entityType: "User",
      entityId: id,
    });

    return jsonOk(result);
  } catch (e) {
    if (e instanceof Error && !(e instanceof AppError) && e.name !== "ZodError") {
      return jsonError(new AppError(e.message, 400));
    }
    return jsonError(e);
  }
}
