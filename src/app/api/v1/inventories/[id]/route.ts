import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError } from "@/shared/kernel/http";
import { getDocumentInventory, updateDocumentInventory } from "@/modules/search-reports";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "reports.read");
    const { id } = await ctx.params;
    const inv = await getDocumentInventory(user, id);
    return jsonOk(inv);
  } catch (e) {
    return jsonError(e);
  }
}

const patchSchema = z.object({
  title: z.string().optional(),
  transferCode: z.string().optional(),
  entitySender: z.string().optional(),
  entityProducer: z.string().optional(),
  adminUnit: z.string().optional(),
  producerOffice: z.string().optional(),
  objectDescription: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        orderNumber: z.number().int().optional(),
        seriesName: z.string().optional(),
        subseriesName: z.string().optional(),
        subject: z.string().optional(),
        expedienteCode: z.string().optional(),
        unitName: z.string().optional(),
        dateStart: z.string().nullable().optional(),
        dateEnd: z.string().nullable().optional(),
        supportPhysical: z.boolean().optional(),
        supportElectronic: z.boolean().optional(),
        boxCode: z.string().optional(),
        folderNumber: z.string().optional(),
        folioCount: z.number().int().nullable().optional(),
        format: z.string().optional(),
        quantity: z.number().int().nullable().optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "reports.export");
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const inv = await updateDocumentInventory(user, id, body);
    return jsonOk(inv);
  } catch (e) {
    return jsonError(e);
  }
}
