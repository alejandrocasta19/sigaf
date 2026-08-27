import { NextRequest } from "next/server";
import { z } from "zod";
import { ArchivalPhase, TransferKind } from "@prisma/client";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import {
  completePhaseTransfer,
  createPhaseTransfer,
  getLifecycleStats,
  listByPhase,
} from "@/modules/loans-transfers";
import { listExpedientesReadiness } from "@/modules/expedientes";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "transfers.read");

    const phase = req.nextUrl.searchParams.get("phase") as ArchivalPhase | null;
    const view = req.nextUrl.searchParams.get("view");
    if (view === "ready") {
      const readiness = await listExpedientesReadiness(user);
      return jsonOk({
        all: readiness,
        ready: readiness.filter((r) => r.ready),
        pending: readiness.filter((r) => !r.ready),
      });
    }
    if (phase && ["MANAGEMENT", "CENTRAL", "HISTORICAL"].includes(phase)) {
      return jsonOk(await listByPhase(user, phase));
    }

    return jsonOk(await getLifecycleStats(user));
  } catch (e) {
    return jsonError(e);
  }
}

const createSchema = z.object({
  title: z.string().min(3),
  kind: z.nativeEnum(TransferKind),
  fromPhase: z.nativeEnum(ArchivalPhase),
  toPhase: z.nativeEnum(ArchivalPhase),
  documentIds: z.array(z.string()).optional(),
  expedienteIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  checklistFoliation: z.boolean().optional(),
  checklistChronological: z.boolean().optional(),
  checklistInventory: z.boolean().optional(),
  checklistBoxFolder: z.boolean().optional(),
  checklistRetentionMet: z.boolean().optional(),
  checklistApproval: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "transfers.create");

    const body = createSchema.parse(await req.json());
    const transfer = await createPhaseTransfer(user, body);

    await writeAudit({
      user,
      action: "TRANSFER_CREATE",
      module: "lifecycle",
      entityType: "Transfer",
      entityId: transfer.id,
      changes: { kind: body.kind, from: body.fromPhase, to: body.toPhase },
      req,
    });

    return jsonOk(transfer, 201);
  } catch (e) {
    if (e instanceof Error && !(e instanceof AppError) && e.name !== "ZodError") {
      return jsonError(new AppError(e.message, 400));
    }
    return jsonError(e);
  }
}
