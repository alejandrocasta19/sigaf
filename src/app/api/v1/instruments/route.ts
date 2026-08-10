import { NextRequest } from "next/server";
import { z } from "zod";
import { InstrumentType } from "@prisma/client";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import {
  createInstrument,
  listInstruments,
  uploadInstrumentFile,
} from "@/modules/archival-instruments";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "instruments.read");
    return jsonOk(await listInstruments(user));
  } catch (e) {
    return jsonError(e);
  }
}

const createSchema = z.object({
  type: z.nativeEnum(InstrumentType),
  name: z.string().min(3),
  version: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "instruments.create");

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const id = String(form.get("id") || "");
      const file = form.get("file");
      if (!id || !(file instanceof File)) throw new AppError("id y file requeridos", 400);
      const buf = Buffer.from(await file.arrayBuffer());
      const updated = await uploadInstrumentFile(user, id, {
        originalName: file.name,
        buffer: buf,
      });
      await writeAudit({
        user,
        action: "INSTRUMENT_UPLOAD",
        module: "instruments",
        entityId: id,
        req,
      });
      return jsonOk(updated);
    }

    const body = createSchema.parse(await req.json());
    const created = await createInstrument(user, body);
    await writeAudit({
      user,
      action: "INSTRUMENT_CREATE",
      module: "instruments",
      entityId: created.id,
      changes: { type: body.type, name: body.name },
      req,
    });
    return jsonOk(created, 201);
  } catch (e) {
    return jsonError(e);
  }
}
