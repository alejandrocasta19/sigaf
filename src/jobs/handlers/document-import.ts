import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { RoleCode } from "@prisma/client";
import { readUpload } from "@/shared/kernel/storage";
import { importDocumentsFromExcel } from "@/modules/search-reports";

type Payload = {
  storageKey?: string;
  userId?: string;
};

async function loadUser(organizationId: string, userId?: string): Promise<SessionUser> {
  if (!userId) throw new Error("userId requerido");
  const u = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    include: { role: { include: { permissions: { include: { permission: true } } } }, dependency: true, organization: true },
  });
  if (!u) throw new Error("Usuario no encontrado");
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`,
    roleCode: u.role.code as RoleCode,
    roleName: u.role.name,
    accessLevel: u.role.accessLevel,
    organizationId: u.organizationId,
    organizationName: u.organization.name,
    dependencyId: u.dependencyId,
    dependencyName: u.dependency?.name ?? null,
    permissions: u.role.permissions.map((p) => p.permission.code),
    avatarUrl: u.avatarUrl,
  };
}

export async function runDocumentImportJob(
  payload: unknown,
  ctx: { organizationId: string; userId?: string }
) {
  const p = (payload ?? {}) as Payload;
  if (!p.storageKey) throw new Error("storageKey requerido");
  const user = await loadUser(ctx.organizationId, p.userId ?? ctx.userId);
  const buffer = await readUpload(p.storageKey);
  return importDocumentsFromExcel(user, buffer);
}
