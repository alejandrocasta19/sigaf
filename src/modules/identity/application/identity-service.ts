import bcrypt from "bcryptjs";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";

export const ADMIN_ROLES = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"] as const;

export function isAdminRole(user: SessionUser) {
  return ADMIN_ROLES.includes(user.roleCode as (typeof ADMIN_ROLES)[number]);
}

export async function listUsers(user: SessionUser) {
  return prisma.user.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: { role: true, dependency: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUser(
  user: SessionUser,
  data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roleId: string;
    dependencyId?: string | null;
  }
) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: {
      organizationId: user.organizationId,
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      roleId: data.roleId,
      dependencyId: data.dependencyId ?? null,
    },
    include: { role: true, dependency: true },
  });
}

export async function listDependencies(user: SessionUser) {
  return prisma.dependency.findMany({
    where: { organizationId: user.organizationId, deletedAt: null, active: true },
    orderBy: { name: "asc" },
  });
}

export async function createDependency(
  user: SessionUser,
  data: { code: string; name: string; description?: string }
) {
  return prisma.dependency.create({
    data: {
      organizationId: user.organizationId,
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
    },
  });
}

export async function listRoles() {
  return prisma.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true, permissions: true } },
    },
    orderBy: { accessLevel: "desc" },
  });
}

export async function updateRole(
  roleId: string,
  data: {
    name?: string;
    description?: string | null;
    accessLevel?: number;
    permissionIds?: string[];
  }
) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Rol no encontrado");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.role.update({
      where: { id: roleId },
      data: {
        name: data.name ?? undefined,
        description: data.description === undefined ? undefined : data.description,
        accessLevel: data.accessLevel ?? undefined,
      },
    });

    if (data.permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (data.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
    }

    return tx.role.findUniqueOrThrow({
      where: { id: updated.id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
      },
    });
  });
}

export async function deleteRole(roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new Error("Rol no encontrado");
  if (role.code === "SUPER_ADMIN") {
    throw new Error("No se puede eliminar el rol Super Administrador");
  }
  if (role._count.users > 0) {
    throw new Error(
      `No se puede eliminar: hay ${role._count.users} usuario(s) asignado(s). Reasigna o elimina esos usuarios primero.`
    );
  }

  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.role.delete({ where: { id: roleId } });
  return role;
}

export async function updateUserRole(
  actor: SessionUser,
  userId: string,
  roleId: string,
  dependencyId?: string | null
) {
  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
  });
  if (!target) throw new Error("Usuario no encontrado");

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new Error("Rol no encontrado");

  if (target.roleId === roleId && actor.id === userId && role.code === "SUPER_ADMIN") {
    // ok — no change of own super admin
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      roleId,
      ...(dependencyId !== undefined ? { dependencyId } : {}),
    },
    include: { role: true, dependency: true },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
}

export async function setUserStatus(
  actor: SessionUser,
  userId: string,
  status: "ACTIVE" | "BLOCKED" | "INACTIVE"
) {
  if (actor.id === userId && status !== "ACTIVE") {
    throw new Error("No puedes bloquearte o desactivarte a ti mismo");
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
  });
  if (!target) throw new Error("Usuario no encontrado");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
    include: { role: true, dependency: true },
  });

  if (status === "BLOCKED" || status === "INACTIVE") {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.notification.create({
      data: {
        organizationId: actor.organizationId,
        userId,
        type: "ALERT",
        title: status === "BLOCKED" ? "Cuenta bloqueada" : "Cuenta desactivada",
        message:
          status === "BLOCKED"
            ? "Tu acceso a SIGAF fue bloqueado por un administrador."
            : "Tu cuenta fue desactivada por un administrador.",
      },
    });
  }

  if (status === "ACTIVE") {
    await prisma.notification.create({
      data: {
        organizationId: actor.organizationId,
        userId,
        type: "SUCCESS",
        title: "Cuenta reactivada",
        message: "Tu acceso a SIGAF fue restaurado.",
      },
    });
  }

  return updated;
}

export async function resetUserPassword(
  actor: SessionUser,
  userId: string,
  newPassword?: string
) {
  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
  });
  if (!target) throw new Error("Usuario no encontrado");

  const password =
    newPassword && newPassword.length >= 6
      ? newPassword
      : `Sigaf${Math.random().toString(36).slice(2, 8)}!`;

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.notification.create({
      data: {
        organizationId: actor.organizationId,
        userId,
        type: "WARNING",
        title: "Contraseña restablecida",
        message: "Un administrador restableció tu contraseña. Usa la nueva para iniciar sesión.",
        link: "/login",
      },
    }),
  ]);

  return { userId, temporaryPassword: password };
}

export async function listOrganizations(user: SessionUser) {
  if (user.roleCode === "SUPER_ADMIN") {
    return prisma.organization.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  }
  return prisma.organization.findMany({
    where: { id: user.organizationId },
  });
}
