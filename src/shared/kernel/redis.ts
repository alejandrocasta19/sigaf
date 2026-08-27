import Redis from "ioredis";

let cacheClient: Redis | null = null;

export function redisEnabled() {
  return Boolean(process.env.REDIS_URL);
}

function redisOptions() {
  return {
    maxRetriesPerRequest: null as null,
    enableReadyCheck: true,
    lazyConnect: false,
  };
}

/** Cliente para caché y rate limit (no usar con BullMQ). */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!cacheClient) {
    cacheClient = new Redis(process.env.REDIS_URL, redisOptions());
    cacheClient.on("error", (err) => {
      console.error("[redis]", err.message);
    });
  }
  return cacheClient;
}

/** Conexión dedicada para Queue/Worker (BullMQ no debe compartir el cliente de caché). */
export function createBullmqConnection(): Redis {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL no configurado");
  }
  const conn = new Redis(process.env.REDIS_URL, redisOptions());
  conn.on("error", (err) => {
    console.error("[redis:bullmq]", err.message);
  });
  return conn;
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* caché opcional */
  }
}

export async function rateLimitHit(key: string, max: number, windowMs: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.pexpire(key, windowMs);
    return n <= max;
  } catch {
    return true;
  }
}
