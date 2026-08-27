import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { getJobQueue } from "./queue";
import { runBackupJob } from "./handlers/backup";
import { runRetentionScanJob } from "./handlers/retention";
import { runDisposalNotifyJob } from "./handlers/disposal-notify";
import { runLoansOverdueScanJob } from "./handlers/loans-overdue";
import { runFileProcessJob } from "./handlers/file-process";
import { runReportExportJob } from "./handlers/report-export";
import { runDocumentImportJob } from "./handlers/document-import";

export type JobHandler = (
  payload: unknown,
  ctx: { organizationId: string; userId?: string }
) => Promise<unknown>;

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
  FILE_PROCESS: "file.process",
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
  registerJob(JOB_TYPES.FILE_PROCESS, async (payload, ctx) => runFileProcessJob(payload, ctx));
  registerJob(JOB_TYPES.REPORT_EXPORT, async (payload, ctx) => runReportExportJob(payload, ctx));
  registerJob(JOB_TYPES.DOCUMENT_IMPORT, async (payload, ctx) => runDocumentImportJob(payload, ctx));
  registered = true;
}

export async function executeJobRecord(jobId: string) {
  ensureJobHandlers();
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError("Job no encontrado", 404);
  const handler = getJobHandler(job.type);
  if (!handler) throw new AppError(`Tipo de job no registrado: ${job.type}`, 400);

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const result = await handler(job.payload, {
      organizationId: job.organizationId ?? "",
      userId: (job.payload as { userId?: string } | null)?.userId,
    });
    return prisma.job.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        result: result as object,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error en job";
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    throw err;
  }
}

/** Encola el job y responde de inmediato (no bloquea el HTTP). */
export async function enqueueJob(
  user: SessionUser,
  type: string,
  payload: unknown = {}
) {
  ensureJobHandlers();
  if (!getJobHandler(type)) throw new AppError(`Tipo de job no registrado: ${type}`, 400);

  const merged = {
    ...(typeof payload === "object" && payload ? payload : {}),
    userId: user.id,
  };

  const job = await prisma.job.create({
    data: {
      organizationId: user.organizationId,
      type,
      payload: merged as object,
      status: "PENDING",
    },
  });

  const queue = getJobQueue();
  if (queue) {
    await queue.add(type, { jobId: job.id }, { jobId: job.id, removeOnComplete: 100 });
  } else {
    setImmediate(() => {
      void executeJobRecord(job.id).catch((err) => console.error("[job]", job.id, err));
    });
  }

  return job;
}

/** @deprecated Preferir enqueueJob. Conservado para tests que esperan el resultado. */
export async function enqueueAndRunJob(
  user: SessionUser,
  type: string,
  payload: unknown = {}
) {
  ensureJobHandlers();
  if (!getJobHandler(type)) throw new AppError(`Tipo de job no registrado: ${type}`, 400);

  const merged = {
    ...(typeof payload === "object" && payload ? payload : {}),
    userId: user.id,
  };
  const job = await prisma.job.create({
    data: {
      organizationId: user.organizationId,
      type,
      payload: merged as object,
      status: "PENDING",
    },
  });
  return executeJobRecord(job.id);
}

export async function listJobs(user: SessionUser, take = 20) {
  return prisma.job.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getJob(user: SessionUser, id: string) {
  const job = await prisma.job.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!job) throw new AppError("Job no encontrado", 404);
  return job;
}
