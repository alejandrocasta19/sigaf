import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError } from "@/shared/kernel/http";
import {
  listDocumentInventories,
  createDocumentInventory,
  validateDocumentInventory,
} from "@/modules/search-reports";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "reports.read");
    const items = await listDocumentInventories(user);
    return jsonOk(items);
  } catch (e) {
    return jsonError(e);
  }
}

const createSchema = z.object({
  title: z.string().min(1),
  transferCode: z.string().optional(),
  expedienteIds: z.array(z.string()).optional(),
  entitySender: z.string().optional(),
  entityProducer: z.string().optional(),
  adminUnit: z.string().optional(),
  producerOffice: z.string().optional(),
  objectDescription: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "reports.export");
    const body = createSchema.parse(await req.json());
    const inv = await createDocumentInventory(user, body);
    return jsonOk(inv, 201);
  } catch (e) {
    return jsonError(e);
  }
}

const patchSchema = z.object({
  id: z.string(),
  action: z.enum(["validate"]),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "reports.export");
    const body = patchSchema.parse(await req.json());
    if (body.action === "validate") {
      const inv = await validateDocumentInventory(user, body.id);
      return jsonOk(inv);
    }
    throw new AppError("Acción no válida", 400);
  } catch (e) {
    return jsonError(e);
  }
}
