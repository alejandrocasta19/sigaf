import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import { buildTransferInventory } from "@/modules/loans-transfers";
import ExcelJS from "exceljs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "transfers.read");
    const { id } = await ctx.params;
    const format = _req.nextUrl.searchParams.get("format") ?? "json";
    const data = await buildTransferInventory(user, id);

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet("Inventario transferencia");
      sheet.addRow(["Código TRF", data.transfer.code, data.transfer.title]);
      sheet.addRow([
        "Checklist",
        `Fol=${data.checklist.foliation}`,
        `Cron=${data.checklist.chronological}`,
        `Inv=${data.checklist.inventory}`,
        `Caja=${data.checklist.boxFolder}`,
      ]);
      sheet.addRow(["Tipo", "Código", "Nombre", "Dependencia", "Serie", "Caja", "Folios"]);
      for (const d of data.documents) {
        sheet.addRow([
          "Documento",
          d.code,
          d.name,
          d.dependency.name,
          d.series?.code ?? "",
          d.folder?.box?.code ?? "",
          d.folioCount,
        ]);
      }
      for (const e of data.expedientes) {
        sheet.addRow(["Expediente", e.code, e.name, e.dependency.name, "", "", ""]);
      }
      const buf = Buffer.from(await wb.xlsx.writeBuffer());
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${data.transfer.code}-inventario.xlsx"`,
        },
      });
    }

    return jsonOk(data);
  } catch (e) {
    return jsonError(e instanceof Error ? new AppError(e.message, 400) : e);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "transfers.read");
    const { id } = await ctx.params;
    await writeAudit({
      user,
      action: "TRANSFER_INVENTORY_EXPORT",
      module: "lifecycle",
      entityType: "Transfer",
      entityId: id,
      req,
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
