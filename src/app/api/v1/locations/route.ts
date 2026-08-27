import { NextRequest } from "next/server";
import { z } from "zod";
import { LocationLevel } from "@prisma/client";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { createLocation, listLocations } from "@/modules/physical-archive";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "boxes.read");
    return jsonOk(await listLocations(user));
  } catch (e) {
    return jsonError(e);
  }
}

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  level: z.nativeEnum(LocationLevel),
  parentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "boxes.create");
    const body = schema.parse(await req.json());
    const loc = await createLocation(user, body);
    await writeAudit({
      user,
      action: "LOCATION_CREATE",
      module: "physical-archive",
      entityType: "Location",
      entityId: loc.id,
      req,
    });
    return jsonOk(loc, 201);
  } catch (e) {
    return jsonError(e);
  }
}
