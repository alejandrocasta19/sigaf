import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { setUserStatus } from "@/modules/identity";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(["ACTIVE", "BLOCKED", "INACTIVE"]),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "users.update");

    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    const updated = await setUserStatus(user, id, body.status);

    await writeAudit({
      user,
      action: body.status === "BLOCKED" ? "USER_BLOCK" : body.status === "ACTIVE" ? "USER_UNBLOCK" : "USER_DEACTIVATE",
      module: "identity",
      entityType: "User",
      entityId: id,
      changes: { status: body.status },
    });

    return jsonOk(updated);
  } catch (e) {
    if (e instanceof Error && !(e instanceof AppError) && e.name !== "ZodError") {
      return jsonError(new AppError(e.message, 400));
    }
    return jsonError(e);
  }
}
