import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { createBox, listBoxes } from "@/modules/physical-archive";

const createSchema = z.object({
  code: z.string().min(1),
  locationId: z.string().optional(),
  capacity: z.number().int().min(1).default(50),
});

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "boxes.read");
    return jsonOk(await listBoxes(user));
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "boxes.create");

    const body = createSchema.parse(await req.json());
    const box = await createBox(user, {
      code: body.code.toUpperCase(),
      locationId: body.locationId,
      capacity: body.capacity,
    });

    await writeAudit({
      user,
      action: "BOX_CREATE",
      module: "physical-archive",
      entityType: "Box",
      entityId: box.id,
    });

    return jsonOk(box, 201);
  } catch (e) {
    return jsonError(e);
  }
}
