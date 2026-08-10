import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";

export async function listBoxes(user: SessionUser) {
  return prisma.box.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: { location: true, _count: { select: { folders: true } } },
    orderBy: { code: "asc" },
  });
}

export async function listFolders(user: SessionUser) {
  return prisma.folder.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: { box: true, _count: { select: { documents: true } } },
    orderBy: { code: "asc" },
  });
}

export async function listLocations(user: SessionUser) {
  return prisma.location.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ level: "asc" }, { code: "asc" }],
  });
}

export async function createBox(
  user: SessionUser,
  data: { code: string; capacity?: number; locationId?: string }
) {
  const qrCode = `BOX-QR-${Date.now()}`;
  return prisma.box.create({
    data: {
      organizationId: user.organizationId,
      code: data.code,
      qrCode,
      capacity: data.capacity ?? 50,
      locationId: data.locationId,
    },
  });
}

export async function createFolder(
  user: SessionUser,
  data: { code: string; name?: string; boxId?: string; color?: string }
) {
  return prisma.folder.create({
    data: {
      organizationId: user.organizationId,
      code: data.code,
      name: data.name,
      boxId: data.boxId,
      color: data.color ?? "#2563EB",
    },
  });
}
