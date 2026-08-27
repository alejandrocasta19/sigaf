import { NextRequest } from "next/server";
import { z } from "zod";
import { DocumentSupport } from "@prisma/client";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError, writeAudit } from "@/shared/kernel/http";
import { addDocumentToExpediente } from "@/modules/expedientes";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  documentTypeId: z.string().optional(),
  folioCount: z.number().int().min(1).optional(),
  documentDate: z.string().optional(),
  observations: z.string().optional(),
  support: z.nativeEnum(DocumentSupport).optional(),
  electronicFormat: z.string().optional(),
  fileName: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    const { id } = await ctx.params;
    const body = createSchema.parse(await req.json());
    const doc = await addDocumentToExpediente(user, id, body);

    await writeAudit({
      user,
      action: "DOCUMENT_ADD_TO_EXPEDIENTE",
      module: "expedientes",
      entityType: "Document",
      entityId: doc.id,
      changes: { expedienteId: id, code: doc.code },
      req,
    });

    return jsonOk(doc, 201);
  } catch (e) {
    return jsonError(e);
  }
}
