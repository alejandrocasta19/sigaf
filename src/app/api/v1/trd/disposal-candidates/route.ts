import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import {
  completeDisposalWithHistory,
  createDisposalFromCandidates,
  exportDisposalCandidatesExcel,
  listDisposalCandidates,
  publishDisposalInventoryPdf,
} from "@/modules/archival-instruments";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "instruments.read");
    const view = req.nextUrl.searchParams.get("view") ?? "candidates";
    if (view === "export") {
      requirePermission(user, "instruments.export");
      const buf = await exportDisposalCandidatesExcel(user);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="candidatos-eliminacion.xlsx"',
        },
      });
    }
    return jsonOk(await listDisposalCandidates(user));
  } catch (e) {
    return jsonError(e);
  }
}

const schema = z.object({
  action: z.enum(["create_from_candidates", "publish_inventory", "complete_with_history"]),
  title: z.string().optional(),
  inventoryNote: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  processId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "instruments.update");
    const body = schema.parse(await req.json());

    let result;
    if (body.action === "create_from_candidates") {
      if (!body.title || !body.documentIds?.length)
        throw new AppError("Título y documentos requeridos", 400);
      result = await createDisposalFromCandidates(user, {
        title: body.title,
        documentIds: body.documentIds,
        inventoryNote: body.inventoryNote,
      });
    } else if (body.action === "publish_inventory") {
      if (!body.processId) throw new AppError("processId requerido", 400);
      result = await publishDisposalInventoryPdf(user, body.processId);
    } else {
      if (!body.processId) throw new AppError("processId requerido", 400);
      result = await completeDisposalWithHistory(user, body.processId);
    }

    await writeAudit({
      user,
      action: `DISPOSAL_${body.action.toUpperCase()}`,
      module: "trd",
      entityId: body.processId,
      req,
    });
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
