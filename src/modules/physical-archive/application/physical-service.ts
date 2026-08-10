import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { LocationLevel } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { saveUpload } from "@/shared/kernel/storage";

export const PHYSICAL_HIERARCHY: { level: LocationLevel; label: string }[] = [
  { level: "BUILDING", label: "Edificio" },
  { level: "FLOOR", label: "Piso" },
  { level: "ROOM", label: "Sala" },
  { level: "SHELF", label: "Estantería" },
  { level: "LEVEL", label: "Nivel" },
];

export function locationLevelLabel(level: string) {
  const map: Record<string, string> = {
    BUILDING: "Edificio",
    FLOOR: "Piso",
    ROOM: "Sala",
    SHELF: "Estantería",
    LEVEL: "Nivel",
    ARCHIVE: "Archivo",
    BLOCK: "Bloque",
    AISLE: "Pasillo",
    RACK: "Estantería",
  };
  return map[level] ?? level;
}

/** Valida principio de procedencia: docs de una caja deben ser misma dependencia */
export async function validateProvenance(user: SessionUser, boxId: string) {
  const folders = await prisma.folder.findMany({
    where: { boxId, organizationId: user.organizationId, deletedAt: null },
    include: {
      documents: {
        where: { deletedAt: null },
        select: { id: true, code: true, dependencyId: true, dependency: { select: { code: true, name: true } } },
      },
    },
  });
  const deps = new Set<string>();
  const docs = folders.flatMap((f) => f.documents);
  for (const d of docs) deps.add(d.dependencyId);

  return {
    ok: deps.size <= 1,
    dependencyCount: deps.size,
    documentCount: docs.length,
    message:
      deps.size <= 1
        ? "Cumple principio de procedencia (una dependencia por caja)"
        : "Incumplimiento: la caja mezcla documentos de varias dependencias",
    documents: docs,
  };
}

/** Orden original: documentos deben tener documentDate ascendente por carpeta */
export async function validateOriginalOrder(user: SessionUser, folderId: string) {
  const docs = await prisma.document.findMany({
    where: { folderId, organizationId: user.organizationId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true, documentDate: true, chronologicalOrder: true },
  });

  let ordered = true;
  for (let i = 1; i < docs.length; i++) {
    const prev = docs[i - 1].documentDate?.getTime() ?? 0;
    const cur = docs[i].documentDate?.getTime() ?? 0;
    if (cur < prev) {
      ordered = false;
      break;
    }
  }

  return {
    ok: ordered || docs.every((d) => d.chronologicalOrder),
    documentCount: docs.length,
    message: ordered
      ? "Orden cronológico / original coherente"
      : "Posible ruptura del orden original (fechas no ascendentes)",
    documents: docs,
  };
}

export async function createPhysicalInventory(
  user: SessionUser,
  data: { title: string; locationId?: string; notes?: string }
) {
  if (!["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEPT_HEAD"].includes(user.roleCode)) {
    throw new AppError("Sin permiso", 403);
  }

  const boxes = await prisma.box.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      ...(data.locationId ? { locationId: data.locationId } : {}),
    },
    include: {
      location: true,
      folders: {
        include: { documents: { where: { deletedAt: null }, select: { id: true, code: true, name: true, folioCount: true } } },
      },
    },
  });

  const year = new Date().getFullYear();
  const count = await prisma.physicalInventory.count({
    where: { organizationId: user.organizationId },
  });
  const code = `INV-FIS-${year}-${String(count + 1).padStart(3, "0")}`;

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Inventario físico");
  sheet.addRow(["Caja", "Ubicación", "Carpeta", "DocCódigo", "DocNombre", "Folios"]);
  let itemCount = 0;
  for (const box of boxes) {
    for (const folder of box.folders) {
      for (const doc of folder.documents) {
        sheet.addRow([
          box.code,
          box.location?.name ?? "",
          folder.code,
          doc.code,
          doc.name,
          doc.folioCount,
        ]);
        itemCount++;
      }
    }
  }

  const xlsxBuf = Buffer.from(await wb.xlsx.writeBuffer());
  const savedXlsx = await saveUpload({
    orgId: user.organizationId,
    category: "documents",
    originalName: `${code}.xlsx`,
    buffer: xlsxBuf,
  });

  const pdf = new jsPDF();
  pdf.setFontSize(14);
  pdf.text(`Acta de inventario físico — ${code}`, 14, 18);
  pdf.setFontSize(10);
  pdf.text(data.title, 14, 26);
  pdf.text(`Ítems: ${itemCount} · ${new Date().toLocaleString("es-CO")}`, 14, 32);
  if (data.notes) pdf.text(data.notes, 14, 38);
  const pdfBuf = Buffer.from(pdf.output("arraybuffer"));
  await saveUpload({
    orgId: user.organizationId,
    category: "documents",
    originalName: `${code}-acta.pdf`,
    buffer: pdfBuf,
  });

  return prisma.physicalInventory.create({
    data: {
      organizationId: user.organizationId,
      code,
      title: data.title,
      locationId: data.locationId,
      notes: data.notes,
      filePath: savedXlsx.relativePath,
      itemCount,
      createdById: user.id,
    },
  });
}

export async function listPhysicalInventories(user: SessionUser) {
  return prisma.physicalInventory.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
