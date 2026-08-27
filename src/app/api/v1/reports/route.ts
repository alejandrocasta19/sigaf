import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import { enqueueJob, JOB_TYPES } from "@/jobs";
import type { ReportFormat, ReportType } from "@/modules/search-reports";

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

    const job = await enqueueJob(user, JOB_TYPES.REPORT_EXPORT, { type, format });
    await writeAudit({
      user,
      action: "REPORT_EXPORT_ENQUEUE",
      module: "reports",
      entityType: "Job",
      entityId: job.id,
      changes: { type, format },
    });

    return jsonOk({ jobId: job.id, status: job.status }, 202);
  } catch (e) {
    return jsonError(e);
  }
}
