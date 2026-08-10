import bcrypt from "bcryptjs";
import { prisma } from "@/shared/kernel/prisma";
import { signToken } from "@/shared/kernel/auth";
import { AUTH_COOKIE } from "@/shared/kernel/types";
import { jsonOk, writeAudit, AppError } from "@/shared/kernel/http";

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
  res.cookies.set(MFA_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
