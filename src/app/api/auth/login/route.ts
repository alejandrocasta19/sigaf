import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { prisma } from "@/shared/kernel/prisma";
import { jsonError, jsonOk, AppError } from "@/shared/kernel/http";
import { notifyUser } from "@/shared/kernel/notify";
import { createSessionResponse, MFA_COOKIE } from "@/shared/kernel/session-login";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_MAX =
  Number(process.env.LOGIN_RATE_MAX) ||
  (process.env.NODE_ENV === "production" ? 20 : 500);

function rateLimit(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= LOGIN_RATE_MAX) return false;
  entry.count += 1;
  return true;
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) throw new Error("JWT_SECRET must be configured");
  return new TextEncoder().encode(secret);
}

async function alertFailedLogins(params: {
  organizationId: string;
  email: string;
  ip: string;
}) {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const fails = await prisma.accessLog.count({
    where: {
      email: params.email.toLowerCase(),
      success: false,
      createdAt: { gte: since },
    },
  });
  if (fails < 5) return;

  const admins = await prisma.user.findMany({
    where: {
      organizationId: params.organizationId,
      status: "ACTIVE",
      deletedAt: null,
      role: { code: { in: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"] } },
    },
    select: { id: true },
    take: 10,
  });
  for (const admin of admins) {
    await notifyUser({
      organizationId: params.organizationId,
      userId: admin.id,
      title: "Alertas de acceso fallido",
      message: `${fails} intentos fallidos recientes para ${params.email} (IP ${params.ip}).`,
      link: "/audit",
      type: "ALERT",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(ip)) throw new AppError("Demasiados intentos. Intente más tarde.", 429);

    const body = schema.parse(await req.json());
    const user = await prisma.user.findFirst({
      where: { email: body.email.toLowerCase(), deletedAt: null },
    });

    const ua = req.headers.get("user-agent") || undefined;

    if (!user || user.status === "BLOCKED" || user.status === "INACTIVE") {
      await prisma.accessLog.create({
        data: { email: body.email, success: false, ipAddress: ip, userAgent: ua },
      });
      throw new AppError("Credenciales inválidas", 401);
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      await prisma.accessLog.create({
        data: { userId: user.id, email: user.email, success: false, ipAddress: ip, userAgent: ua },
      });
      await alertFailedLogins({
        organizationId: user.organizationId,
        email: user.email,
        ip,
      }).catch(() => undefined);
      throw new AppError("Credenciales inválidas", 401);
    }

    if (user.mfaEnabled && user.mfaSecret) {
      const challenge = await new SignJWT({
        purpose: "mfa",
        userId: user.id,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(jwtSecret());

      const res = jsonOk({ requiresMfa: true });
      res.cookies.set(MFA_COOKIE, challenge, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 5,
      });
      return res;
    }

    return createSessionResponse(user.id, ip, ua);
  } catch (e) {
    return jsonError(e, "Error de autenticación");
  }
}
