import { InstrumentType } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { saveUpload } from "@/shared/kernel/storage";

export async function listInstruments(user: SessionUser) {
  return prisma.archivalInstrument.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { type: "asc" },
  });
}

export async function listSeries(user: SessionUser) {
  return prisma.documentarySeries.findMany({
    where: { organizationId: user.organizationId },
    include: { subseries: true },
    orderBy: { code: "asc" },
  });
}

export async function createInstrument(
  user: SessionUser,
  data: {
    type: InstrumentType;
    name: string;
    version?: string;
    description?: string;
  }
) {
  if (!["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode)) {
    throw new AppError("Sin permiso", 403);
  }
  return prisma.archivalInstrument.create({
    data: {
      organizationId: user.organizationId,
      type: data.type,
      name: data.name.trim(),
      version: data.version || "1.0",
      notes: data.description,
      seriesCount: 0,
      lastUpdated: new Date(),
      active: true,
    },
  });
}

export async function uploadInstrumentFile(
  user: SessionUser,
  id: string,
  file: { originalName: string; buffer: Buffer }
) {
  if (!["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode)) {
    throw new AppError("Sin permiso", 403);
  }
  const inst = await prisma.archivalInstrument.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!inst) throw new AppError("Instrumento no encontrado", 404);

  const saved = await saveUpload({
    orgId: user.organizationId,
    category: "instruments",
    originalName: file.originalName,
    buffer: file.buffer,
  });

  return prisma.archivalInstrument.update({
    where: { id },
    data: { filePath: saved.relativePath, lastUpdated: new Date() },
  });
}
