import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";

export async function listOrganizations(user: SessionUser) {
  if (user.roleCode === "SUPER_ADMIN") {
    return prisma.organization.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  }
  return prisma.organization.findMany({ where: { id: user.organizationId } });
}

export async function listDependencies(user: SessionUser) {
  return prisma.dependency.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}
