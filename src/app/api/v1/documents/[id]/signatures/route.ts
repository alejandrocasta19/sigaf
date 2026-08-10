import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import {
  listSignatures,
  signDocument,
} from "@/modules/documents/application/digitize-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.read");
    const { id } = await ctx.params;
    return jsonOk(await listSignatures(user, id));
  } catch (e) {
    return jsonError(e);
  }
}

const schema = z.object({
  signerName: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.approve");
    const { id } = await ctx.params;
    const body = schema.parse(await req.json().catch(() => ({})));
    const sig = await signDocument(user, id, body.signerName);
    await writeAudit({
      user,
      action: "DOCUMENT_SIGN",
      module: "documents",
      entityType: "DigitalSignature",
      entityId: sig.id,
      changes: { documentId: id, hash: sig.hash },
      req,
    });
    return jsonOk(sig, 201);
  } catch (e) {
    return jsonError(e);
  }
}
