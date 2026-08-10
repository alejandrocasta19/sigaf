import { NextRequest, NextResponse } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, writeAudit } from "@/shared/kernel/http";
import { exportFuidExcel } from "@/modules/search-reports/application/fuid-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "reports.export");

    const dependencyId = req.nextUrl.searchParams.get("dependencyId") || undefined;
    const buf = await exportFuidExcel(user, dependencyId);

    await writeAudit({
      user,
      action: "FUID_EXPORT",
      module: "inventories",
      changes: { dependencyId, bytes: buf.length },
      req,
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="FUID-SIGAF.xlsx"',
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
