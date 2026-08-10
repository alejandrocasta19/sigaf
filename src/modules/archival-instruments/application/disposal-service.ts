import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import { saveUpload } from "@/shared/kernel/storage";
import {
  advanceDisposalProcess,
  createDisposalProcess,
  finalDispositionLabel,
} from "./trd-service";

/** Candidatos a eliminación: disposición ELIMINATION y retención vencida */
export async function listDisposalCandidates(user: SessionUser) {
  const now = new Date();
  return prisma.document.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      OR: [
        { appliedFinalDisposition: "ELIMINATION", retentionDueAt: { lte: now } },
        {
          appliedFinalDisposition: null,
          series: { finalDisposition: "ELIMINATION" },
          OR: [
            { retentionDueAt: { lte: now } },
            {
              AND: [
                { retentionDueAt: null },
                {
                  documentDate: {
                    lte: new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()),
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    include: { dependency: true, series: true, subseries: true },
    orderBy: { retentionDueAt: "asc" },
    take: 200,
  });
}

export async function createDisposalFromCandidates(
  user: SessionUser,
  data: { title: string; documentIds: string[]; inventoryNote?: string }
) {
  if (!data.documentIds.length) throw new AppError("Seleccione documentos", 400);
  return createDisposalProcess(user, {
    title: data.title,
    inventoryNote: data.inventoryNote,
    documentIds: data.documentIds,
  });
}

export async function publishDisposalInventoryPdf(user: SessionUser, processId: string) {
  const process = await prisma.disposalProcess.findFirst({
    where: { id: processId, organizationId: user.organizationId },
  });
  if (!process) throw new AppError("Proceso no encontrado", 404);

  const ids = (Array.isArray(process.documentIds) ? process.documentIds : []) as string[];
  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    include: { dependency: true, series: true },
  });

  const pdf = new jsPDF();
  pdf.setFontSize(14);
  pdf.text(`Inventario de eliminación — ${process.code}`, 14, 18);
  pdf.setFontSize(10);
  pdf.text(process.title, 14, 26);
  pdf.text(`Publicado: ${new Date().toLocaleString("es-CO")}`, 14, 32);

  let y = 42;
  pdf.text("Código | Nombre | Dependencia | Serie | Folios", 14, y);
  y += 6;
  for (const d of docs) {
    const line = `${d.code} | ${d.name.slice(0, 40)} | ${d.dependency.code} | ${d.series?.code ?? "—"} | ${d.folioCount}`;
    if (y > 280) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, 14, y);
    y += 6;
  }

  const buffer = Buffer.from(pdf.output("arraybuffer"));
  const saved = await saveUpload({
    orgId: user.organizationId,
    category: "documents",
    originalName: `${process.code}-inventario.pdf`,
    buffer,
  });

  await prisma.disposalProcess.update({
    where: { id: processId },
    data: {
      inventoryFilePath: saved.relativePath,
      status: "INVENTORY_PUBLISHED",
      publishedAt: new Date(),
    },
  });

  return { filePath: saved.relativePath, count: docs.length };
}

export async function completeDisposalWithHistory(user: SessionUser, processId: string) {
  const process = await prisma.disposalProcess.findFirst({
    where: { id: processId, organizationId: user.organizationId },
  });
  if (!process) throw new AppError("Proceso no encontrado", 404);

  const ids = (Array.isArray(process.documentIds) ? process.documentIds : []) as string[];
  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    include: { dependency: true },
  });

  // Expediente de historial de eliminación
  const year = new Date().getFullYear();
  const code = `ELIM-HIST-${year}-${process.code.slice(-3)}`;
  const depId =
    docs[0]?.dependencyId ??
    (
      await prisma.dependency.findFirst({
        where: { organizationId: user.organizationId, code: "130" },
      })
    )?.id;

  if (!depId) throw new AppError("No hay dependencia para historial", 400);

  const historyExp = await prisma.expediente.create({
    data: {
      organizationId: user.organizationId,
      dependencyId: depId,
      code,
      name: `Historial eliminación ${process.code}`,
      description: `Conservación del historial del proceso ${process.title}. Documentos: ${ids.join(", ")}`,
      status: "CLOSED",
      archivalPhase: "HISTORICAL",
      responsibleId: user.id,
      closedAt: new Date(),
    },
  });

  // Acta PDF
  const pdf = new jsPDF();
  pdf.setFontSize(14);
  pdf.text(`Acta de eliminación — ${process.code}`, 14, 18);
  pdf.setFontSize(10);
  pdf.text(process.title, 14, 26);
  pdf.text(process.actaNote || process.technicalConcept || "Acta conforme TRD", 14, 34);
  pdf.text(`Expediente historial: ${historyExp.code}`, 14, 42);
  let y = 52;
  for (const d of docs) {
    pdf.text(`- ${d.code} ${d.name}`, 14, y);
    y += 6;
  }
  const buffer = Buffer.from(pdf.output("arraybuffer"));
  const saved = await saveUpload({
    orgId: user.organizationId,
    category: "documents",
    originalName: `${process.code}-acta.pdf`,
    buffer,
  });

  await prisma.disposalProcess.update({
    where: { id: processId },
    data: {
      actaFilePath: saved.relativePath,
      historyExpedienteId: historyExp.id,
      status: "APPROVED",
    },
  });

  return advanceDisposalProcess(user, processId, "complete");
}

export async function exportDisposalCandidatesExcel(user: SessionUser) {
  const rows = await listDisposalCandidates(user);
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Candidatos");
  sheet.addRow([
    "Código",
    "Nombre",
    "Dependencia",
    "Serie",
    "Disposición",
    "Vence retención",
    "Folios",
  ]);
  for (const d of rows) {
    sheet.addRow([
      d.code,
      d.name,
      d.dependency.name,
      d.series?.name ?? "",
      d.appliedFinalDisposition ?? d.series?.finalDisposition ?? "",
      d.retentionDueAt?.toISOString().slice(0, 10) ?? "",
      d.folioCount,
    ]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export { finalDispositionLabel };
