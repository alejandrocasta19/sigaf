import { NextRequest, NextResponse } from "next/server";
import { rateLimitHit, redisEnabled } from "@/shared/kernel/redis";

/** Rate limit compartido (Redis). Llamado por el middleware Edge; no usar ioredis ahí. */
export async function POST(req: NextRequest) {
  const secret = process.env.CSRF_SECRET || "";
  if (!secret || req.headers.get("x-rl-secret") !== secret) {
    return new NextResponse(null, { status: 403 });
  }
  if (!redisEnabled()) {
    return new NextResponse(null, { status: 204 });
  }
  const ip = req.headers.get("x-rl-ip") || "local";
  const max = Number(req.headers.get("x-rl-max")) || 120;
  const windowMs = Number(req.headers.get("x-rl-window")) || 60_000;
  const ok = await rateLimitHit(`api:${ip}`, max, windowMs);
  return new NextResponse(null, { status: ok ? 204 : 429 });
}
