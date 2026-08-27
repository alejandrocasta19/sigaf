import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import { enqueueJob, JOB_TYPES, listJobs, ensureJobHandlers } from "@/jobs";

ensureJobHandlers();

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "jobs.read");
    return jsonOk(await listJobs(user));
  } catch (e) {
    return jsonError(e);
  }
}

const schema = z.object({
  type: z.enum([
    JOB_TYPES.BACKUP,
    JOB_TYPES.RETENTION_SCAN,
    JOB_TYPES.DISPOSAL_NOTIFY,
    JOB_TYPES.LOANS_OVERDUE,
    JOB_TYPES.REPORT_EXPORT,
    JOB_TYPES.DOCUMENT_IMPORT,
  ]),
  payload: z.unknown().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const body = schema.parse(await req.json());
    if (body.type === JOB_TYPES.BACKUP) requirePermission(user, "backups.create");
    else requirePermission(user, "jobs.create");

    const job = await enqueueJob(user, body.type, body.payload ?? {});
    await writeAudit({
      user,
      action: "JOB_ENQUEUE",
      module: "jobs",
      entityType: "Job",
      entityId: job.id,
      changes: { type: body.type, status: job.status },
      req,
    });
    return jsonOk(job, 202);
  } catch (e) {
    return jsonError(e);
  }
}
