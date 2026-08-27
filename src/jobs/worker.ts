import { Worker } from "bullmq";
import { createBullmqConnection, redisEnabled } from "@/shared/kernel/redis";
import { SIGAF_QUEUE } from "./queue";
import { executeJobRecord, ensureJobHandlers } from "./index";

ensureJobHandlers();

async function main() {
  if (!redisEnabled()) {
    console.error("REDIS_URL no configurado. El worker requiere Redis.");
    process.exit(1);
  }
  const connection = createBullmqConnection();

  const worker = new Worker(
    SIGAF_QUEUE,
    async (job) => {
      const jobId = (job.data as { jobId?: string }).jobId ?? job.id;
      if (!jobId) throw new Error("jobId ausente");
      await executeJobRecord(String(jobId));
    },
    { connection, concurrency: Number(process.env.JOB_CONCURRENCY) || 4 }
  );

  worker.on("failed", (job, err) => {
    console.error("[worker] failed", job?.id, err.message);
  });
  worker.on("completed", (job) => {
    console.info("[worker] completed", job.id);
  });

  console.info("SIGAF worker listo", SIGAF_QUEUE);
}

void main();
