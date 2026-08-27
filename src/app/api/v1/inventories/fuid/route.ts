import { NextRequest, NextResponse } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, writeAudit } from "@/shared/kernel/http";
import { exportFuidExcel, exportFuidPdf } from "@/modules/search-reports/application/fuid-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "reports.export");

    const sp = req.nextUrl.searchParams;
    const dependencyId = sp.get("dependencyId") || undefined;
    const inventoryId = sp.get("inventoryId") || undefined;
    const expedienteIds = sp.get("expedienteIds")?.split(",").filter(Boolean);
    const objeto = sp.get("objeto") || undefined;
    const format = sp.get("format") || "xlsx";
    const opts = { dependencyId, inventoryId, expedienteIds, objeto };

    if (format === "pdf") {
      const buf = await exportFuidPdf(user, opts);
      await writeAudit({
        user,
        action: "FUID_EXPORT",
        module: "inventories",
        changes: { dependencyId, inventoryId, format: "pdf", bytes: buf.length },
        req,
      });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="FUID-AGN-Acuerdo001-2024.pdf"',
        },
      });
    }

    const buf = await exportFuidExcel(user, opts);

    await writeAudit({
      user,
      action: "FUID_EXPORT",
      module: "inventories",
      changes: { dependencyId, inventoryId, format: "xlsx", bytes: buf.length },
      req,
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="FUID-AGN-Acuerdo001-2024.xlsx"',
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
