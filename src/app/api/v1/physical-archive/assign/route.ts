import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission, requireAnyPermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { assignExpedienteToPhysical } from "@/modules/physical-archive";

const schema = z.object({
  expedienteId: z.string().min(1),
  boxId: z.string().min(1),
  folderId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requireAnyPermission(user, ["boxes.update", "boxes.create"]);
    const body = schema.parse(await req.json());
    const exp = await assignExpedienteToPhysical(user, body);
    await writeAudit({
      user,
      action: "EXPEDIENTE_ASSIGN_PHYSICAL",
      module: "physical-archive",
      entityType: "Expediente",
      entityId: exp.id,
      changes: { boxCode: exp.boxCode, folderNumber: exp.folderNumber },
      req,
    });
    return jsonOk(exp);
  } catch (e) {
    return jsonError(e);
  }
}
