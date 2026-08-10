import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { approveLoan, rejectLoan, returnLoan } from "@/modules/loans-transfers";

const patchSchema = z.object({
  action: z.enum(["approve", "reject", "return"]),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const { id } = await ctx.params;
    const { action } = patchSchema.parse(await req.json());

    let loan;
    if (action === "approve") {
      requirePermission(user, "loans.approve");
      loan = await approveLoan(user, id);
    } else if (action === "reject") {
      requirePermission(user, "loans.approve");
      loan = await rejectLoan(user, id);
    } else {
      // Solicitante o gestora: validación en returnLoan
      requirePermission(user, "loans.read");
      loan = await returnLoan(user, id);
    }

    await writeAudit({
      user,
      action: `LOAN_${action.toUpperCase()}`,
      module: "loans",
      entityType: "Loan",
      entityId: id,
    });

    return jsonOk(loan);
  } catch (e) {
    return jsonError(e);
  }
}
