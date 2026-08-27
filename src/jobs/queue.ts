import { Queue } from "bullmq";
import { createBullmqConnection, redisEnabled } from "@/shared/kernel/redis";

export const SIGAF_QUEUE = "sigaf-jobs";

let queue: Queue | null = null;

export function getJobQueue(): Queue | null {
  if (!redisEnabled()) return null;
  if (!queue) {
    queue = new Queue(SIGAF_QUEUE, { connection: createBullmqConnection() });
  }
  return queue;
}
