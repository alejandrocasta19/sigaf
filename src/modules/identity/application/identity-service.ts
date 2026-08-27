import bcrypt from "bcryptjs";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { USER_WITH_ROLE_DEP_SELECT } from "@/shared/kernel/user-privacy";
import { assertPasswordPolicy } from "@/shared/kernel/password-policy";

export const ADMIN_ROLES = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"] as const;

export function isAdminRole(user: SessionUser) {
  return ADMIN_ROLES.includes(user.roleCode as (typeof ADMIN_ROLES)[number]);
}

async function assertCanAssignRole(actor: SessionUser, roleId: string) {
  const [actorRole, targetRole] = await Promise.all([
    prisma.role.findUnique({ where: { code: actor.roleCode } }),
    prisma.role.findUnique({ where: { id: roleId } }),
  ]);
  if (!targetRole) throw new AppError("Rol no encontrado", 400);
  if (!actorRole) throw new AppError("Rol del actor no encontrado", 403);

  if (actor.roleCode === "SUPER_ADMIN") return targetRole;

  if (targetRole.code === "SUPER_ADMIN") {
    throw new AppError("No puede asignar el rol Super Administrador", 403);
  }
  if (targetRole.accessLevel >= actorRole.accessLevel) {
    throw new AppError(
      "No puede asignar un rol con nivel de acceso igual o superior al suyo",
      403
    );
  }
  return targetRole;
}

async function assertDependencyInOrg(organizationId: string, dependencyId: string | null | undefined) {
  if (!dependencyId) return;
  const dep = await prisma.dependency.findFirst({
    where: { id: dependencyId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!dep) throw new AppError("Dependencia no válida para la organización", 400);
}

export async function listUsers(
  user: SessionUser,
  opts?: { cursor?: string | null; take?: number }
) {
  const take = opts?.take ?? 50;
  const items = await prisma.user.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    select: USER_WITH_ROLE_DEP_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  return {
    items: page,
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    hasMore,
  };
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
  await assertCanAssignRole(user, data.roleId);
  await assertDependencyInOrg(user.organizationId, data.dependencyId);

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
    select: USER_WITH_ROLE_DEP_SELECT,
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
  if (!isAdminRole(user)) throw new AppError("Sin permiso para crear dependencias", 403);

  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();
  if (!/^[A-Z0-9]{1,12}$/.test(code)) {
    throw new AppError("El código debe ser alfanumérico (1-12 caracteres, p. ej. 40 o JUR)", 400);
  }
  if (name.length < 3) throw new AppError("Indique el nombre de la dependencia", 400);

  const existing = await prisma.dependency.findFirst({
    where: { organizationId: user.organizationId, code },
  });
  if (existing && !existing.deletedAt) {
    throw new AppError(`Ya existe una dependencia con el código ${code}`, 409);
  }
  if (existing?.deletedAt) {
    return prisma.dependency.update({
      where: { id: existing.id },
      data: {
        name,
        description: data.description?.trim() || existing.description,
        active: true,
        deletedAt: null,
      },
    });
  }

  return prisma.dependency.create({
    data: {
      organizationId: user.organizationId,
      code,
      name,
      description: data.description?.trim() || null,
    },
  });
}

export async function updateDependency(
  user: SessionUser,
  id: string,
  data: { name?: string; description?: string | null; active?: boolean }
) {
  if (!isAdminRole(user)) throw new AppError("Sin permiso para editar dependencias", 403);
  const dep = await prisma.dependency.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!dep) throw new AppError("Dependencia no encontrada", 404);
  return prisma.dependency.update({
    where: { id },
    data: {
      ...(data.name != null ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
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

  await assertCanAssignRole(actor, roleId);
  await assertDependencyInOrg(actor.organizationId, dependencyId);

  return prisma.user.update({
    where: { id: userId },
    data: {
      roleId,
      ...(dependencyId !== undefined ? { dependencyId } : {}),
    },
    select: USER_WITH_ROLE_DEP_SELECT,
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
    select: USER_WITH_ROLE_DEP_SELECT,
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

export async function changeOwnPassword(
  user: SessionUser,
  data: { currentPassword: string; newPassword: string }
) {
  const dbUser = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
    select: { id: true, passwordHash: true },
  });
  if (!dbUser) throw new AppError("Usuario no encontrado", 404);

  const valid = await bcrypt.compare(data.currentPassword, dbUser.passwordHash);
  if (!valid) throw new AppError("La contraseña actual no es correcta", 400);

  assertPasswordPolicy(data.newPassword);

  const passwordHash = await bcrypt.hash(data.newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(user.sessionId ? { NOT: { id: user.sessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function listOrganizations(user: SessionUser) {
  if (user.roleCode === "SUPER_ADMIN") {
    return prisma.organization.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  }
  return prisma.organization.findMany({
    where: { id: user.organizationId },
  });
}
