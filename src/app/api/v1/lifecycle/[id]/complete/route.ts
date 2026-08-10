import { NextRequest } from "next/server";
import { getSession } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import { completePhaseTransfer } from "@/modules/loans-transfers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const { id } = await ctx.params;
    const transfer = await completePhaseTransfer(user, id);

    await writeAudit({
      user,
      action: "TRANSFER_COMPLETE",
      module: "lifecycle",
      entityType: "Transfer",
      entityId: id,
      changes: { toPhase: transfer?.toPhase, kind: transfer?.kind },
    });

    return jsonOk(transfer);
  } catch (e) {
    if (e instanceof Error && !(e instanceof AppError)) {
      return jsonError(new AppError(e.message, 400));
    }
    return jsonError(e);
  }
}
