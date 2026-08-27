import { getSession, hasPermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk } from "@/shared/kernel/http";
import { getJob } from "@/jobs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    if (!hasPermission(user, "jobs.read") && !hasPermission(user, "reports.export")) {
      throw new AppError("Sin permiso", 403);
    }
    const { id } = await ctx.params;
    return jsonOk(await getJob(user, id));
  } catch (e) {
    return jsonError(e);
  }
}
