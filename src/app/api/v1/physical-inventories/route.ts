import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import {
  createPhysicalInventory,
  listPhysicalInventories,
  validateOriginalOrder,
  validateProvenance,
} from "@/modules/physical-archive";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "boxes.read");
    const view = req.nextUrl.searchParams.get("view") ?? "list";
    const boxId = req.nextUrl.searchParams.get("boxId");
    const folderId = req.nextUrl.searchParams.get("folderId");

    if (view === "provenance" && boxId) {
      return jsonOk(await validateProvenance(user, boxId));
    }
    if (view === "order" && folderId) {
      return jsonOk(await validateOriginalOrder(user, folderId));
    }
    return jsonOk(await listPhysicalInventories(user));
  } catch (e) {
    return jsonError(e);
  }
}

const schema = z.object({
  title: z.string().min(3),
  locationId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "boxes.create");
    const body = schema.parse(await req.json());
    const inv = await createPhysicalInventory(user, body);
    await writeAudit({
      user,
      action: "PHYSICAL_INVENTORY_CREATE",
      module: "physical-archive",
      entityType: "PhysicalInventory",
      entityId: inv.id,
      req,
    });
    return jsonOk(inv, 201);
  } catch (e) {
    return jsonError(e);
  }
}
