import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FinalDisposition } from "@prisma/client";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import {
  createSeries,
  createSubseries,
  createTypology,
  exportTrdExcel,
  importTrdExcel,
  listTrdVersions,
  listTypologies,
  snapshotTrdVersion,
  updateSeries,
  updateSubseries,
  updateTypology,
  applyTrdCalculationToDocument,
} from "@/modules/archival-instruments";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "instruments.read");
    const view = req.nextUrl.searchParams.get("view");

    if (view === "export") {
      requirePermission(user, "instruments.export");
      const buf = await exportTrdExcel(user);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="TRD-COOTRANSHUILA.xlsx"',
        },
      });
    }
    if (view === "versions") return jsonOk(await listTrdVersions(user));
    if (view === "typologies") return jsonOk(await listTypologies(user));
    throw new AppError("view inválido", 400);
  } catch (e) {
    return jsonError(e);
  }
}

const seriesSchema = z.object({
  action: z.enum([
    "create_series",
    "update_series",
    "create_subseries",
    "update_subseries",
    "create_typology",
    "update_typology",
    "snapshot",
    "apply_calc",
  ]),
  id: z.string().optional(),
  seriesId: z.string().optional(),
  documentId: z.string().optional(),
  version: z.string().optional(),
  notes: z.string().optional(),
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  dependencyId: z.string().nullable().optional(),
  retentionManagementYears: z.number().optional(),
  retentionCentralYears: z.number().optional(),
  finalDisposition: z.nativeEnum(FinalDisposition).optional(),
  valueAdministrative: z.boolean().optional(),
  valueJuridical: z.boolean().optional(),
  valueLegal: z.boolean().optional(),
  valueFiscal: z.boolean().optional(),
  valueAccounting: z.boolean().optional(),
  valueHistorical: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "instruments.update");

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      requirePermission(user, "instruments.create");
      const form = await req.formData();
      const file = form.get("file");
      if (!file || !(file instanceof File)) throw new AppError("Adjunte Excel TRD", 400);
      const buf = Buffer.from(await file.arrayBuffer());
      const result = await importTrdExcel(user, buf);
      await writeAudit({
        user,
        action: "TRD_IMPORT",
        module: "trd",
        changes: result,
        req,
      });
      return jsonOk(result);
    }

    const body = seriesSchema.parse(await req.json());
    let result;

    switch (body.action) {
      case "create_series":
        if (!body.code || !body.name) throw new AppError("code y name requeridos", 400);
        result = await createSeries(user, body as never);
        break;
      case "update_series":
        if (!body.id) throw new AppError("id requerido", 400);
        result = await updateSeries(user, body.id, body);
        break;
      case "create_subseries":
        if (!body.seriesId || !body.code || !body.name)
          throw new AppError("seriesId, code y name requeridos", 400);
        result = await createSubseries(user, body.seriesId, body as never);
        break;
      case "update_subseries":
        if (!body.id) throw new AppError("id requerido", 400);
        result = await updateSubseries(user, body.id, body);
        break;
      case "create_typology":
        if (!body.code || !body.name) throw new AppError("code y name requeridos", 400);
        result = await createTypology(user, body as never);
        break;
      case "update_typology":
        if (!body.id) throw new AppError("id requerido", 400);
        result = await updateTypology(user, body.id, body);
        break;
      case "snapshot":
        if (!body.version) throw new AppError("version requerida", 400);
        result = await snapshotTrdVersion(user, body.version, body.notes);
        break;
      case "apply_calc":
        if (!body.documentId) throw new AppError("documentId requerido", 400);
        result = await applyTrdCalculationToDocument(user, body.documentId);
        break;
      default:
        throw new AppError("Acción no soportada", 400);
    }

    await writeAudit({
      user,
      action: `TRD_${body.action.toUpperCase()}`,
      module: "trd",
      entityType: "DocumentarySeries",
      entityId: body.id ?? body.seriesId,
      req,
    });
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
