import { NextRequest, NextResponse } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, writeAudit } from "@/shared/kernel/http";
import {
  buildCsv,
  buildExcelBuffer,
  buildPdfBuffer,
  fetchReportRows,
  type ReportFormat,
  type ReportType,
} from "@/modules/search-reports";

const TYPES: ReportType[] = ["documents", "expedientes", "loans", "audit"];
const FORMATS: ReportFormat[] = ["xlsx", "pdf", "csv"];

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "reports.export");

    const type = req.nextUrl.searchParams.get("type") as ReportType;
    const format = (req.nextUrl.searchParams.get("format") || "xlsx") as ReportFormat;

    if (!TYPES.includes(type)) throw new AppError("Tipo de reporte inválido", 400);
    if (!FORMATS.includes(format)) throw new AppError("Formato inválido", 400);

    const data = await fetchReportRows(user, type);
    let buffer: Buffer;
    let contentType: string;
    let ext: string;

    if (format === "xlsx") {
      buffer = await buildExcelBuffer(data.title, data.headers, data.rows);
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      ext = "xlsx";
    } else if (format === "pdf") {
      buffer = buildPdfBuffer(data.title, data.headers, data.rows);
      contentType = "application/pdf";
      ext = "pdf";
    } else {
      buffer = buildCsv(data.headers, data.rows);
      contentType = "text/csv; charset=utf-8";
      ext = "csv";
    }

    await writeAudit({
      user,
      action: "REPORT_EXPORT",
      module: "reports",
      changes: { type, format, rows: data.rows.length },
    });

    const filename = `sigaf-${type}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
