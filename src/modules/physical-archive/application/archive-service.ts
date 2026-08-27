import { LocationLevel } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { buildBoxQrPayload } from "@/shared/kernel/qr-codes";
import { generateBoxLabelPdf } from "@/modules/expedientes/application/label-service";

function assertManage(user: SessionUser) {
  if (!["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEPT_HEAD"].includes(user.roleCode)) {
    throw new AppError("Sin permiso para administrar el archivo físico", 403);
  }
}

async function nextCode(orgId: string, prefix: string, model: "box" | "folder") {
  const last =
    model === "box"
      ? await prisma.box.findFirst({
          where: { organizationId: orgId, code: { startsWith: prefix } },
          orderBy: { code: "desc" },
          select: { code: true },
        })
      : await prisma.folder.findFirst({
          where: { organizationId: orgId, code: { startsWith: prefix } },
          orderBy: { code: "desc" },
          select: { code: true },
        });
  let seq = 1;
  if (last?.code) {
    const n = parseInt(last.code.replace(/\D/g, "").slice(-4), 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function createLocation(
  user: SessionUser,
  data: { code: string; name: string; level: LocationLevel; parentId?: string }
) {
  assertManage(user);
  return prisma.location.create({
    data: {
      organizationId: user.organizationId,
      code: data.code.trim(),
      name: data.name.trim(),
      level: data.level,
      parentId: data.parentId || null,
    },
  });
}

export async function createBox(
  user: SessionUser,
  data: { code?: string; capacity?: number; locationId?: string }
) {
  assertManage(user);
  const code = data.code?.trim() || (await nextCode(user.organizationId, "CAJ-", "box"));
  const exists = await prisma.box.findFirst({
    where: { organizationId: user.organizationId, code },
  });
  if (exists) throw new AppError("Ya existe una caja con ese código", 409);
  return prisma.box.create({
    data: {
      organizationId: user.organizationId,
      code,
      qrCode: `SIGAF-BOX-${code}-${Date.now().toString(36).toUpperCase()}`,
      capacity: data.capacity ?? 20,
      locationId: data.locationId || null,
    },
  });
}

export async function createFolder(
  user: SessionUser,
  data: { code?: string; name?: string; boxId?: string; color?: string }
) {
  assertManage(user);
  const code = data.code?.trim() || (await nextCode(user.organizationId, "CAR-", "folder"));
  const exists = await prisma.folder.findFirst({
    where: { organizationId: user.organizationId, code },
  });
  if (exists) throw new AppError("Ya existe una carpeta con ese código", 409);

  const folder = await prisma.folder.create({
    data: {
      organizationId: user.organizationId,
      code,
      name: data.name?.trim(),
      boxId: data.boxId || null,
      color: data.color ?? "#2563EB",
    },
  });

  if (data.boxId) {
    await prisma.box.update({
      where: { id: data.boxId },
      data: { currentCount: { increment: 1 } },
    });
  }
  return folder;
}

export async function assignExpedienteToPhysical(
  user: SessionUser,
  data: { expedienteId: string; boxId: string; folderId?: string }
) {
  assertManage(user);
  const exp = await prisma.expediente.findFirst({
    where: { id: data.expedienteId, organizationId: user.organizationId, deletedAt: null },
    include: { documents: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!exp) throw new AppError("Expediente no encontrado", 404);

  const box = await prisma.box.findFirst({
    where: { id: data.boxId, organizationId: user.organizationId, deletedAt: null },
  });
  if (!box) throw new AppError("Caja no encontrada", 404);

  let folder = data.folderId
    ? await prisma.folder.findFirst({
        where: { id: data.folderId, organizationId: user.organizationId, deletedAt: null },
      })
    : null;

  if (!folder) {
    folder = await createFolder(user, {
      name: exp.subject ?? exp.name,
      boxId: box.id,
    });
  } else if (folder.boxId !== box.id) {
    await prisma.folder.update({ where: { id: folder.id }, data: { boxId: box.id } });
  }

  const docIds = exp.documents.map((d) => d.id);
  if (docIds.length) {
    await prisma.document.updateMany({
      where: { id: { in: docIds } },
      data: { folderId: folder.id },
    });
  }

  return prisma.expediente.update({
    where: { id: exp.id },
    data: {
      boxCode: box.code,
      folderNumber: folder.code,
    },
    include: { dependency: true },
  });
}

export async function generateStoredBoxLabelPdf(user: SessionUser, boxId: string) {
  const box = await prisma.box.findFirst({
    where: { id: boxId, organizationId: user.organizationId, deletedAt: null },
    include: {
      location: { include: { parent: { include: { parent: true } } } },
      folders: {
        where: { deletedAt: null },
        include: {
          documents: {
            where: { deletedAt: null },
            select: { documentDate: true, expediente: { select: { dependency: true, dateStart: true, dateEnd: true } } },
          },
        },
        orderBy: { code: "asc" },
      },
    },
  });
  if (!box) throw new AppError("Caja no encontrada", 404);

  const folderCodes = box.folders.map((f) => f.code);
  const folderRange =
    folderCodes.length === 0
      ? "—"
      : folderCodes.length === 1
        ? folderCodes[0]
        : `${folderCodes[0]} – ${folderCodes[folderCodes.length - 1]}`;

  const dates: Date[] = [];
  let section = "—";
  for (const f of box.folders) {
    for (const d of f.documents) {
      if (d.documentDate) dates.push(d.documentDate);
      if (d.expediente?.dependency?.name) section = d.expediente.dependency.name;
      if (d.expediente?.dateStart) dates.push(d.expediente.dateStart);
      if (d.expediente?.dateEnd) dates.push(d.expediente.dateEnd);
    }
  }
  const years = dates.map((d) => d.getFullYear());
  const dateRange = years.length
    ? `${Math.min(...years)} – ${Math.max(...years)}`
    : "—";

  const locParts = [box.location?.parent?.parent?.name, box.location?.parent?.name, box.location?.name].filter(
    Boolean
  );

  const { buildBoxQrPayload } = await import("@/shared/kernel/qr-codes");

  return generateBoxLabelPdf(user, {
    boxCode: box.code,
    section,
    subsection: locParts.join(" / ") || "Archivo físico",
    folderRange,
    dateRange,
    qrPayload: buildBoxQrPayload(box.code, box.qrCode),
  });
}

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
    include: { parent: { select: { id: true, name: true, code: true } } },
    orderBy: [{ level: "asc" }, { code: "asc" }],
  });
}

export async function getBoxDetail(user: SessionUser, boxId: string) {
  const box = await prisma.box.findFirst({
    where: { id: boxId, organizationId: user.organizationId, deletedAt: null },
    include: {
      location: { include: { parent: { include: { parent: true } } } },
      folders: {
        where: { deletedAt: null },
        include: {
          _count: { select: { documents: true } },
          documents: {
            where: { deletedAt: null },
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              expedienteId: true,
              expediente: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  subject: true,
                  seriesId: true,
                  series: { select: { name: true } },
                },
              },
            },
            take: 50,
          },
        },
        orderBy: { code: "asc" },
      },
    },
  });
  if (!box) return null;

  const expedientes = await prisma.expediente.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      boxCode: box.code,
    },
    select: {
      id: true,
      code: true,
      name: true,
      subject: true,
      folderNumber: true,
      status: true,
      seriesId: true,
      series: { select: { name: true } },
      dependency: { select: { name: true } },
      _count: { select: { documents: true } },
    },
    orderBy: { code: "asc" },
  });

  const history = await prisma.auditLog.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [
        { entityType: "Box", entityId: box.id },
        {
          AND: [
            { module: { in: ["physical-archive", "archive", "identity"] } },
            { action: { contains: "BOX" } },
            { entityId: box.id },
          ],
        },
      ],
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const locParts = [
    box.location?.parent?.parent?.name,
    box.location?.parent?.name,
    box.location?.name,
  ].filter(Boolean);

  return {
    ...box,
    locationPath: locParts.join(" / ") || "Sin ubicación",
    expedientes,
    history,
  };
}
