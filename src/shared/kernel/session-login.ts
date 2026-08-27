import bcrypt from "bcryptjs";
import { prisma } from "@/shared/kernel/prisma";
import { signToken } from "@/shared/kernel/auth";
import { AUTH_COOKIE, CSRF_COOKIE } from "@/shared/kernel/types";
import { jsonOk, writeAudit, AppError } from "@/shared/kernel/http";
import { generateCsrfToken, csrfCookieOptions } from "@/shared/kernel/csrf";

export const MFA_COOKIE = "sigaf_mfa_challenge";

export async function createSessionResponse(userId: string, ip: string, ua?: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null, status: "ACTIVE" },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      organization: true,
      dependency: true,
    },
  });
  if (!user) throw new AppError("Usuario no disponible", 401);

  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pendingHash = await bcrypt.hash(`pending-${user.id}-${Date.now()}`, 8);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: pendingHash,
      ipAddress: ip,
      userAgent: ua,
      expiresAt,
    },
  });

  const sessionUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    roleCode: user.role.code,
    roleName: user.role.name,
    accessLevel: user.role.accessLevel,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    dependencyId: user.dependencyId,
    dependencyName: user.dependency?.name ?? null,
    permissions: user.role.permissions.map((p) => p.permission.code),
    avatarUrl: user.avatarUrl,
    sessionId: session.id,
    mfaEnabled: user.mfaEnabled,
  };

  const token = await signToken(sessionUser);
  const tokenHash = await bcrypt.hash(token.slice(-32), 8);

  await prisma.$transaction([
    prisma.session.update({ where: { id: session.id }, data: { tokenHash } }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    prisma.accessLog.create({
      data: { userId: user.id, email: user.email, success: true, ipAddress: ip, userAgent: ua },
    }),
  ]);

  await writeAudit({
    user: sessionUser,
    action: "LOGIN",
    module: "auth",
    ipAddress: ip,
  });

  const res = jsonOk({ user: sessionUser });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  res.cookies.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieOptions());
  res.cookies.set(MFA_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

/** Re-emite JWT tras cambios de perfil (p.ej. activar MFA) sin nueva sesión. */
export async function refreshSessionCookie(user: {
  id: string;
  sessionId?: string;
  mfaEnabled?: boolean;
}) {
  if (!user.sessionId) return null;

  const dbUser = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null, status: "ACTIVE" },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      organization: true,
      dependency: true,
    },
  });
  if (!dbUser) return null;

  const sessionUser = {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    fullName: `${dbUser.firstName} ${dbUser.lastName}`,
    roleCode: dbUser.role.code,
    roleName: dbUser.role.name,
    accessLevel: dbUser.role.accessLevel,
    organizationId: dbUser.organizationId,
    organizationName: dbUser.organization.name,
    dependencyId: dbUser.dependencyId,
    dependencyName: dbUser.dependency?.name ?? null,
    permissions: dbUser.role.permissions.map((p) => p.permission.code),
    avatarUrl: dbUser.avatarUrl,
    sessionId: user.sessionId,
    mfaEnabled: dbUser.mfaEnabled,
  };

  const token = await signToken(sessionUser);
  const res = jsonOk({ refreshed: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
