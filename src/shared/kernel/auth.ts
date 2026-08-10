import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { AUTH_COOKIE, type SessionUser } from "./types";
import {
  hasPermission,
  requirePermission,
  requireAnyPermission,
} from "./permissions";
import { AppError } from "./http";

export { hasPermission, requirePermission, requireAnyPermission };

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: SessionUser, expiresIn = process.env.JWT_EXPIRES_IN || "8h") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/** Valida JWT + sesión en BD (no revocada, no expirada) + usuario ACTIVE. */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.id) return null;

  // Tokens antiguos sin sessionId: forzar re-login
  if (!payload.sessionId) return null;

  const session = await prisma.session.findFirst({
    where: {
      id: payload.sessionId,
      userId: payload.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: { select: { status: true, deletedAt: true } },
    },
  });

  if (!session) return null;
  if (session.user.deletedAt || session.user.status !== "ACTIVE") return null;

  return payload;
}

export async function revokeSession(sessionId: string | undefined | null) {
  if (!sessionId) return;
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function canAccessDependency(user: SessionUser, dependencyId: string | null | undefined) {
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"].includes(user.roleCode)) return true;
  if (!dependencyId) return true;
  return user.dependencyId === dependencyId;
}

/** Comprueba Origin/Referer en mutaciones (mitigación CSRF). */
export function assertSameOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const host = req.headers.get("host");
  if (!host) return;

  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new AppError("Origen no permitido", 403);
    }
    if (originHost !== host) throw new AppError("Origen no permitido", 403);
    return;
  }

  const referer = req.headers.get("referer");
  if (referer) {
    let refHost: string;
    try {
      refHost = new URL(referer).host;
    } catch {
      throw new AppError("Origen no permitido", 403);
    }
    if (refHost !== host) throw new AppError("Origen no permitido", 403);
  }
}
