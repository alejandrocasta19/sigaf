/**
 * Jobs asíncronos in-process (import, export, backup, retención).
 */
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { runBackupJob } from "./handlers/backup";
import { runRetentionScanJob } from "./handlers/retention";
import { runDisposalNotifyJob } from "./handlers/disposal-notify";
import { runLoansOverdueScanJob } from "./handlers/loans-overdue";

export type JobHandler = (payload: unknown, ctx: { organizationId: string; userId?: string }) => Promise<unknown>;

const handlers = new Map<string, JobHandler>();

export function registerJob(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}

export function getJobHandler(type: string) {
  return handlers.get(type);
}

export const JOB_TYPES = {
  DOCUMENT_IMPORT: "document.import",
  REPORT_EXPORT: "report.export",
  BACKUP: "system.backup",
  RETENTION_SCAN: "retention.scan",
  DISPOSAL_NOTIFY: "disposal.candidates.notify",
  LOANS_OVERDUE: "loans.overdue.scan",
} as const;

let registered = false;

export function ensureJobHandlers() {
  if (registered) return;
  registerJob(JOB_TYPES.BACKUP, async (payload, ctx) => runBackupJob(ctx.organizationId, payload));
  registerJob(JOB_TYPES.RETENTION_SCAN, async (_payload, ctx) => runRetentionScanJob(ctx.organizationId));
  registerJob(JOB_TYPES.DISPOSAL_NOTIFY, async (_payload, ctx) => runDisposalNotifyJob(ctx.organizationId));
  registerJob(JOB_TYPES.LOANS_OVERDUE, async (_payload, ctx) =>
    runLoansOverdueScanJob(ctx.organizationId)
  );
  registered = true;
}

export async function enqueueAndRunJob(
  user: SessionUser,
  type: string,
  payload: unknown = {}
) {
  ensureJobHandlers();
  const handler = getJobHandler(type);
  if (!handler) throw new AppError(`Tipo de job no registrado: ${type}`, 400);

  const job = await prisma.job.create({
    data: {
      organizationId: user.organizationId,
      type,
      payload: payload as object,
      status: "PENDING",
    },
  });

  await prisma.job.update({
    where: { id: job.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const result = await handler(payload, {
      organizationId: user.organizationId,
      userId: user.id,
    });
    return prisma.job.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        result: result as object,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error en job";
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: message,
        finishedAt: new Date(),
      },
    });
    throw new AppError(message, 500);
  }
}

export async function listJobs(user: SessionUser, take = 20) {
  return prisma.job.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
