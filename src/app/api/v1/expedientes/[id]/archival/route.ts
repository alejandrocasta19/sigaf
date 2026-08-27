import { NextRequest } from "next/server";
import { z } from "zod";
import { RetentionStartEvent } from "@prisma/client";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError } from "@/shared/kernel/http";
import {
  updateExpedienteProcessStep,
  updateExpedienteFoliation,
  reorderExpedienteDocuments,
  setExpedienteRetention,
  updateExpedientePhysicalLabels,
} from "@/modules/expedientes";
import { claimExpedienteVersion } from "@/modules/expedientes/application/expedientes-service";
import { closeExpediente } from "@/modules/expedientes/application/expediente-cycle-service";

type Ctx = { params: Promise<{ id: string }> };

const stepSchema = z.object({
  action: z.literal("process_step"),
  step: z.enum([
    "IDENTIFICATION",
    "CLASSIFICATION",
    "ORDERING",
    "FOLIATION",
    "LABELING",
    "FUID_INVENTORY",
  ]),
  done: z.boolean(),
});

const foliationSchema = z.object({
  action: z.literal("foliation"),
  assignments: z.array(
    z.object({
      documentId: z.string(),
      folioStart: z.number().int().min(1),
      folioCount: z.number().int().min(1),
    })
  ),
  chronologicalOrder: z.boolean(),
  foliationVerified: z.boolean(),
  physicalFoliationDone: z.boolean().optional(),
  foliationMethod: z.enum(["MANUAL_PENCIL", "OTHER"]).optional(),
  foliationBy: z.string().optional(),
  foliationAt: z.string().optional(),
});

const reorderSchema = z.object({
  action: z.literal("reorder"),
  documentIds: z.array(z.string()),
});

const retentionSchema = z.object({
  action: z.literal("retention"),
  retentionStartEvent: z.nativeEnum(RetentionStartEvent),
  retentionStartDate: z.string(),
});

const labelsSchema = z.object({
  action: z.literal("labels"),
  folderNumber: z.string().optional(),
  boxCode: z.string().optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
});

const closeSchema = z.object({
  action: z.literal("close"),
});

const bodySchema = z.discriminatedUnion("action", [
  stepSchema,
  foliationSchema,
  reorderSchema,
  retentionSchema,
  labelsSchema,
  closeSchema,
]);

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    const { id } = await ctx.params;
    const raw = await req.json();
    const expectedVersion =
      typeof raw === "object" && raw && "version" in raw && typeof raw.version === "number"
        ? raw.version
        : undefined;
    const body = bodySchema.parse(raw);
    await claimExpedienteVersion(user, id, expectedVersion);

    if (body.action === "process_step") {
      const updated = await updateExpedienteProcessStep(user, id, body.step, body.done);
      return jsonOk(updated);
    }
    if (body.action === "foliation") {
      const updated = await updateExpedienteFoliation(user, id, body);
      return jsonOk(updated);
    }
    if (body.action === "reorder") {
      const updated = await reorderExpedienteDocuments(user, id, body.documentIds);
      return jsonOk(updated);
    }
    if (body.action === "retention") {
      const updated = await setExpedienteRetention(user, id, body);
      return jsonOk(updated);
    }
    if (body.action === "close") {
      const updated = await closeExpediente(user, id);
      return jsonOk(updated);
    }
    const updated = await updateExpedientePhysicalLabels(user, id, body);
    return jsonOk(updated);
  } catch (e) {
    return jsonError(e);
  }
}
