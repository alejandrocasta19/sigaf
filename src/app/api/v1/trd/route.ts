import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import {
  advanceDisposalProcess,
  createDisposalProcess,
  getTrdStats,
  listDisposalProcesses,
  listTrdDependencies,
  listTrdTable,
} from "@/modules/archival-instruments";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "instruments.read");

    const view = req.nextUrl.searchParams.get("view") ?? "table";
    const dependencyId = req.nextUrl.searchParams.get("dependencyId");

    if (view === "stats") return jsonOk(await getTrdStats(user));
    if (view === "dependencies") return jsonOk(await listTrdDependencies(user));
    if (view === "disposals") return jsonOk(await listDisposalProcesses(user));
    return jsonOk(await listTrdTable(user, dependencyId));
  } catch (e) {
    return jsonError(e);
  }
}

const disposalSchema = z.object({
  action: z.enum([
    "create",
    "publish",
    "observations",
    "technical",
    "acta",
    "approve",
    "complete",
    "cancel",
  ]),
  id: z.string().optional(),
  title: z.string().optional(),
  inventoryNote: z.string().optional(),
  notes: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "instruments.read");
    const body = disposalSchema.parse(await req.json());

    if (body.action === "create") {
      if (!body.title?.trim()) throw new AppError("Indique el título del proceso", 400);
      const created = await createDisposalProcess(user, {
        title: body.title.trim(),
        inventoryNote: body.inventoryNote,
        documentIds: body.documentIds,
      });
      await writeAudit({
        user,
        action: "DISPOSAL_CREATE",
        module: "trd",
        entityType: "DisposalProcess",
        entityId: created.id,
        changes: { code: created.code },
      });
      return jsonOk(created, 201);
    }

    if (!body.id) throw new AppError("id requerido", 400);
    const updated = await advanceDisposalProcess(
      user,
      body.id,
      body.action,
      body.notes
    );
    await writeAudit({
      user,
      action: `DISPOSAL_${body.action.toUpperCase()}`,
      module: "trd",
      entityType: "DisposalProcess",
      entityId: updated.id,
      changes: { status: updated.status },
    });
    return jsonOk(updated);
  } catch (e) {
    return jsonError(e);
  }
}
