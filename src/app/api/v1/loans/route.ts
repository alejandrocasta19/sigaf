import { NextRequest } from "next/server";
import { z } from "zod";
import { LoanStatus } from "@prisma/client";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import {
  listLoans,
  listAvailableDocumentsForLoan,
  requestLoan,
} from "@/modules/loans-transfers";

const createSchema = z.object({
  documentId: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "loans.read");

    const available = req.nextUrl.searchParams.get("available");
    if (available === "1") {
      const q = req.nextUrl.searchParams.get("q") || undefined;
      const docs = await listAvailableDocumentsForLoan(user, q);
      return jsonOk(docs);
    }

    const status = req.nextUrl.searchParams.get("status") as LoanStatus | null;
    const loans = await listLoans(user, status || undefined);
    return jsonOk(loans);
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "loans.create");

    const body = createSchema.parse(await req.json());
    const loan = await requestLoan(user, {
      documentId: body.documentId,
      notes: body.notes,
    });

    await writeAudit({
      user,
      action: "LOAN_REQUEST",
      module: "loans",
      entityType: "Loan",
      entityId: loan.id,
    });

    return jsonOk(loan, 201);
  } catch (e) {
    return jsonError(e);
  }
}
