import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";

export type FuidExportOpts = {
  dependencyId?: string;
  inventoryId?: string;
  expedienteIds?: string[];
  objeto?: string;
};

export type FuidRow = {
  order: number;
  code: string;
  seriesName: string;
  unitName: string;
  dateStart: string;
  dateEnd: string;
  physical: boolean;
  electronic: boolean;
  box: string;
  folder: string;
  tomo: string;
  folios: string | number;
  type: string;
  quantity: string | number;
  size: string;
  location: string;
  notes: string;
};

export type FuidHeader = {
  entitySender: string;
  entityProducer: string;
  adminUnit: string;
  producerOffice: string;
  objeto: string;
  registroEntrada: string;
  elaborationDate: Date;
  unitCount: number;
};

export type FuidData = {
  header: FuidHeader;
  rows: FuidRow[];
};

function fuidDate(d: Date | null | undefined) {
  if (!d) return "S.F.";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function locationPath(loc: { name: string; parent?: { name: string; parent?: { name: string } | null } | null } | null | undefined) {
  if (!loc) return "";
  const parts = [loc.name];
  if (loc.parent?.name) parts.unshift(loc.parent.name);
  if (loc.parent?.parent?.name) parts.unshift(loc.parent.parent.name);
  return parts.join(" / ");
}

function truncate(text: string, max: number) {
  const s = String(text ?? "");
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Resuelve cabecera AGN + filas FUID desde inventario guardado o expedientes. */
export async function loadFuidData(user: SessionUser, opts?: FuidExportOpts): Promise<FuidData> {
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true },
  });

  let inventory:
    | {
        code: string;
        title: string;
        transferCode: string | null;
        entitySender: string | null;
        entityProducer: string | null;
        adminUnit: string | null;
        producerOffice: string | null;
        objectDescription: string | null;
        createdAt: Date;
        items: {
          orderNumber: number | null;
          expedienteCode: string | null;
          seriesName: string | null;
          subseriesName: string | null;
          subject: string | null;
          unitName: string | null;
          dateStart: Date | null;
          dateEnd: Date | null;
          supportPhysical: boolean;
          supportElectronic: boolean;
          boxCode: string | null;
          folderNumber: string | null;
          folioCount: number | null;
          format: string | null;
          quantity: number | null;
          sizeBytes: number | null;
          location: string | null;
          notes: string | null;
        }[];
      }
    | null = null;

  const expWhere: Prisma.ExpedienteWhereInput = {
    organizationId: user.organizationId,
    deletedAt: null,
    ...(opts?.dependencyId ? { dependencyId: opts.dependencyId } : {}),
    ...(user.dependencyId &&
    (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER")
      ? { dependencyId: user.dependencyId }
      : {}),
  };

  if (opts?.inventoryId) {
    inventory = await prisma.documentInventory.findFirst({
      where: { id: opts.inventoryId, organizationId: user.organizationId },
      include: {
        items: { orderBy: [{ orderNumber: "asc" }, { expedienteCode: "asc" }] },
      },
    });
    const items = await prisma.documentInventoryItem.findMany({
      where: { inventoryId: opts.inventoryId },
      select: { expedienteId: true },
    });
    const expIds = [...new Set(items.map((i) => i.expedienteId).filter(Boolean) as string[])];
    if (expIds.length) expWhere.id = { in: expIds };
  } else if (opts?.expedienteIds?.length) {
    expWhere.id = { in: opts.expedienteIds };
  }

  const expedientes = await prisma.expediente.findMany({
    where: expWhere,
    include: {
      dependency: true,
      series: true,
      subseries: true,
      documents: {
        where: { deletedAt: null },
        include: {
          attachments: { select: { sizeBytes: true } },
          folder: { include: { box: { include: { location: { include: { parent: { include: { parent: true } } } } } } } },
        },
        orderBy: [{ sortOrder: "asc" }, { documentDate: "asc" }],
      },
    },
    orderBy: [{ dependency: { code: "asc" } }, { code: "asc" }],
    take: 5000,
  });

  const now = inventory?.createdAt ?? new Date();
  const nt = inventory?.transferCode ?? "";
  const objeto =
    opts?.objeto ??
    inventory?.objectDescription ??
    inventory?.title ??
    "Inventario documental / Transferencias primarias";

  const header: FuidHeader = {
    entitySender: inventory?.entitySender ?? org?.name ?? "",
    entityProducer: inventory?.entityProducer ?? org?.name ?? "",
    adminUnit: inventory?.adminUnit ?? expedientes[0]?.dependency.name ?? "",
    producerOffice: inventory?.producerOffice ?? expedientes[0]?.dependency.name ?? "",
    objeto,
    registroEntrada: `AÑO ${now.getFullYear()}  MES ${String(now.getMonth() + 1).padStart(2, "0")}  DÍA ${String(now.getDate()).padStart(2, "0")}   NT: ${nt || "—"}`,
    elaborationDate: now,
    unitCount: 0,
  };

  const rows: FuidRow[] = [];
  let orden = 1;
  const invItems = inventory?.items ?? [];

  if (invItems.length) {
    for (const item of invItems) {
      const seriesName = [item.seriesName, item.subseriesName, item.subject].filter(Boolean).join(" / ");
      rows.push({
        order: item.orderNumber ?? orden,
        code: item.expedienteCode ?? "",
        seriesName,
        unitName: item.unitName ?? item.subject ?? "",
        dateStart: fuidDate(item.dateStart),
        dateEnd: fuidDate(item.dateEnd),
        physical: item.supportPhysical,
        electronic: item.supportElectronic,
        box: item.boxCode ?? "",
        folder: item.folderNumber ?? "",
        tomo: "",
        folios: item.folioCount ?? "",
        type: item.format ?? "",
        quantity: item.quantity ?? "",
        size: formatBytes(item.sizeBytes ?? 0),
        location: item.location ?? "",
        notes: item.notes ?? "",
      });
      orden += 1;
    }
  } else {
    for (const e of expedientes) {
      const docs = e.documents;
      const dates = docs.map((d) => d.documentDate).filter(Boolean) as Date[];
      const start = e.dateStart ?? (dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null);
      const end = e.dateEnd ?? (dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null);
      const folios = e.folioEnd && e.folioStart ? e.folioEnd - e.folioStart + 1 : docs.reduce((s, d) => s + (d.folioCount || 0), 0);
      const supports = new Set(docs.map((d) => d.support));
      const hasPhysical = supports.has("PHYSICAL") || supports.has("HYBRID") || !docs.length;
      const hasElectronic = supports.has("ELECTRONIC") || supports.has("HYBRID");
      const eDocs = docs.filter((d) => d.support !== "PHYSICAL");
      const size = eDocs.reduce(
        (s, d) => s + d.attachments.reduce((a, att) => a + (att.sizeBytes ?? 0), 0),
        0
      );
      const types = [...new Set(eDocs.map((d) => d.electronicFormat).filter(Boolean) as string[])];
      const loc = docs.find((d) => d.folder?.box?.location)?.folder?.box?.location ?? null;
      const seriesName = [e.series?.name, e.subseries?.name, e.subject ?? e.name].filter(Boolean).join(" / ");
      const notes = [
        e.description,
        e.appliedFinalDisposition ? `Disposición: ${e.appliedFinalDisposition}` : null,
        e.appliedRetentionMgmt != null ? `AG ${e.appliedRetentionMgmt} años` : null,
      ]
        .filter(Boolean)
        .join(". ");

      rows.push({
        order: orden,
        code: e.code,
        seriesName,
        unitName: e.subject ?? e.name,
        dateStart: fuidDate(start),
        dateEnd: fuidDate(end),
        physical: hasPhysical,
        electronic: hasElectronic,
        box: e.boxCode ?? docs.find((d) => d.folder?.box?.code)?.folder?.box?.code ?? "",
        folder: e.folderNumber ?? docs.find((d) => d.folder?.code)?.folder?.code ?? "",
        tomo: "",
        folios: folios || "",
        type: types.join(", "),
        quantity: eDocs.length || "",
        size: formatBytes(size),
        location: locationPath(loc),
        notes,
      });
      orden += 1;
    }
  }

  header.unitCount = rows.length;
  return { header, rows };
}

function buildFuidPdfBuffer(data: FuidData): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 7;
  const navy = { r: 30, g: 58, b: 95 };

  const colWidths = [8, 14, 26, 26, 11, 11, 6, 8, 9, 9, 11, 9, 9, 7, 9, 20, 20];
  const colX: number[] = [];
  let x = margin;
  for (const w of colWidths) {
    colX.push(x);
    x += w;
  }

  const drawPageHeader = (startY: number) => {
    doc.setFontSize(10);
    doc.setTextColor(navy.r, navy.g, navy.b);
    doc.text(
      "ARCHIVO GENERAL DE LA NACIÓN — FORMATO ÚNICO DE INVENTARIO DOCUMENTAL (FUID)",
      pageW / 2,
      startY,
      { align: "center" }
    );
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text("Acuerdo AGN 001 de 2024 · Anexo 3", pageW / 2, startY + 4, { align: "center" });
    return startY + 8;
  };

  let y = drawPageHeader(10);

  const headerFields: [string, string][] = [
    ["ENTIDAD REMITENTE", data.header.entitySender],
    ["ENTIDAD PRODUCTORA", data.header.entityProducer],
    ["UNIDAD ADMINISTRATIVA", data.header.adminUnit],
    ["OFICINA PRODUCTORA", data.header.producerOffice],
    ["OBJETO", data.header.objeto],
    ["REGISTRO DE ENTRADA", data.header.registroEntrada],
  ];

  doc.setFontSize(6.5);
  doc.setTextColor(0, 0, 0);
  for (const [label, value] of headerFields) {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(truncate(value, 140), margin + 42, y);
    y += 4;
  }
  y += 2;

  const drawTableHeader = () => {
    const groupH = 5;
    doc.setFillColor(navy.r, navy.g, navy.b);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");

    const groups: { label: string; from: number; to: number }[] = [
      { label: "IDENTIFICACIÓN", from: 0, to: 3 },
      { label: "FECHAS EXTREMAS", from: 4, to: 5 },
      { label: "SOPORTE", from: 6, to: 7 },
      { label: "FÍSICO — CONSERVACIÓN", from: 8, to: 11 },
      { label: "ELECTRÓNICO", from: 12, to: 15 },
      { label: "NOTAS", from: 16, to: 16 },
    ];

    for (const g of groups) {
      const gx = colX[g.from];
      const gw = colX[g.to] + colWidths[g.to] - gx;
      doc.rect(gx, y, gw, groupH, "F");
      doc.text(g.label, gx + gw / 2, y + 3.5, { align: "center" });
    }
    y += groupH;

    const titles = [
      "Nº",
      "Código",
      "Serie / subserie / asunto",
      "Unidad documental",
      "Inicial",
      "Final",
      "Fís.",
      "Elect.",
      "Caja",
      "Carpeta",
      "Tomo",
      "Folios",
      "Tipo",
      "Cant.",
      "Tamaño",
      "Ubicación",
      "Notas",
    ];

    doc.setFillColor(232, 238, 244);
    doc.setTextColor(0, 0, 0);
    const titleH = 6;
    titles.forEach((title, i) => {
      doc.rect(colX[i], y, colWidths[i], titleH, "F");
      doc.text(title, colX[i] + colWidths[i] / 2, y + 4, { align: "center" });
    });
    y += titleH;
  };

  drawTableHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  const rowH = 5;
  const bottomLimit = pageH - 18;

  for (const row of data.rows) {
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = drawPageHeader(10) + 28;
      drawTableHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
    }

    const cells = [
      String(row.order),
      row.code,
      row.seriesName,
      row.unitName,
      row.dateStart,
      row.dateEnd,
      row.physical ? "X" : "",
      row.electronic ? "X" : "",
      row.box,
      row.folder,
      row.tomo,
      String(row.folios),
      row.type,
      String(row.quantity),
      row.size,
      row.location,
      row.notes,
    ];

    cells.forEach((cell, i) => {
      doc.rect(colX[i], y, colWidths[i], rowH);
      doc.text(truncate(cell, i <= 3 ? 28 : 16), colX[i] + 0.5, y + 3.5);
    });
    y += rowH;
  }

  y = Math.min(y + 6, pageH - 12);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("ELABORADO POR: _______________________", margin, y);
  doc.text("ENTREGADO POR: _______________________", margin + 90, y);
  doc.text("RECIBIDO POR: _______________________", margin + 180, y);
  doc.setFontSize(5.5);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Fecha elaboración: ${data.header.elaborationDate.toLocaleDateString("es-CO")} · Unidades: ${data.header.unitCount} · SIGAF`,
    margin,
    y + 5
  );

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * FUID oficial AGN — Acuerdo 001 de 2024, Anexo 3 (Excel).
 */
export async function exportFuidExcel(user: SessionUser, opts?: FuidExportOpts) {
  const data = await loadFuidData(user, opts);

  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGAF";
  wb.created = new Date();
  const sheet = wb.addWorksheet("FUID", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });

  const navy = "1E3A5F";
  const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${navy}` } };
  const subFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF4" } };
  const whiteFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 9, name: "Calibri" };

  sheet.mergeCells("A1:Q1");
  sheet.getCell("A1").value = "ARCHIVO GENERAL DE LA NACIÓN — FORMATO ÚNICO DE INVENTARIO DOCUMENTAL (FUID)";
  sheet.getCell("A1").font = { bold: true, size: 13, name: "Calibri", color: { argb: `FF${navy}` } };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:Q2");
  sheet.getCell("A2").value = "Acuerdo AGN 001 de 2024 · Anexo 3";
  sheet.getCell("A2").alignment = { horizontal: "center" };
  sheet.getCell("A2").font = { italic: true, size: 9, name: "Calibri" };

  const headerRows: [string, string][] = [
    ["ENTIDAD REMITENTE", data.header.entitySender],
    ["ENTIDAD PRODUCTORA", data.header.entityProducer],
    ["UNIDAD ADMINISTRATIVA", data.header.adminUnit],
    ["OFICINA PRODUCTORA", data.header.producerOffice],
    ["OBJETO", data.header.objeto],
    ["REGISTRO DE ENTRADA", data.header.registroEntrada],
  ];

  headerRows.forEach((row, i) => {
    const r = 4 + i;
    sheet.getCell(`A${r}`).value = row[0];
    sheet.getCell(`A${r}`).font = { bold: true, size: 9, name: "Calibri" };
    sheet.mergeCells(`B${r}:Q${r}`);
    sheet.getCell(`B${r}`).value = row[1];
    sheet.getCell(`B${r}`).font = { size: 9, name: "Calibri" };
  });

  const groupRow = 11;
  const titleRow = 12;
  sheet.mergeCells(groupRow, 1, groupRow, 4);
  sheet.getCell(groupRow, 1).value = "IDENTIFICACIÓN";
  sheet.mergeCells(groupRow, 5, groupRow, 6);
  sheet.getCell(groupRow, 5).value = "FECHAS EXTREMAS (AAAA-MM-DD)";
  sheet.mergeCells(groupRow, 7, groupRow, 8);
  sheet.getCell(groupRow, 7).value = "SOPORTE O FORMATO";
  sheet.mergeCells(groupRow, 9, groupRow, 12);
  sheet.getCell(groupRow, 9).value = "FÍSICO — UNIDAD DE CONSERVACIÓN (PAPEL)";
  sheet.mergeCells(groupRow, 13, groupRow, 16);
  sheet.getCell(groupRow, 13).value = "ELECTRÓNICO";
  sheet.getCell(groupRow, 17).value = "NOTAS";

  for (let c = 1; c <= 17; c++) {
    const cell = sheet.getCell(groupRow, c);
    cell.fill = headerFill;
    cell.font = whiteFont;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  }

  const columns = [
    "NÚMERO DE ORDEN",
    "CÓDIGO",
    "NOMBRE DE LA SERIE, SUBSERIE O ASUNTO",
    "NOMBRE DE LA UNIDAD DOCUMENTAL",
    "Inicial",
    "Final",
    "Físico",
    "Electrónico",
    "Caja",
    "Carpeta",
    "Tomo / legajo / libro",
    "Número de folios",
    "Tipo",
    "Cantidad",
    "Tamaño",
    "Ubicación",
    "Notas",
  ];
  columns.forEach((name, i) => {
    const cell = sheet.getCell(titleRow, i + 1);
    cell.value = name;
    cell.fill = subFill;
    cell.font = { bold: true, size: 8, name: "Calibri" };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  sheet.getRow(groupRow).height = 22;
  sheet.getRow(titleRow).height = 32;

  sheet.columns = [
    { width: 10 },
    { width: 18 },
    { width: 36 },
    { width: 36 },
    { width: 14 },
    { width: 14 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 28 },
    { width: 28 },
  ];

  for (const row of data.rows) {
    const excelRow = sheet.addRow([
      row.order,
      row.code,
      row.seriesName,
      row.unitName,
      row.dateStart,
      row.dateEnd,
      row.physical ? "X" : "",
      row.electronic ? "X" : "",
      row.box,
      row.folder,
      row.tomo,
      row.folios,
      row.type,
      row.quantity,
      row.size,
      row.location,
      row.notes,
    ]);
    excelRow.eachCell((cell) => {
      cell.font = { size: 8, name: "Calibri" };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    excelRow.getCell(1).alignment = { horizontal: "center" };
    excelRow.getCell(7).alignment = { horizontal: "center" };
    excelRow.getCell(8).alignment = { horizontal: "center" };
  }

  const firmas = sheet.rowCount + 3;
  sheet.mergeCells(`A${firmas}:D${firmas}`);
  sheet.getCell(`A${firmas}`).value = "ELABORADO POR: _______________________________";
  sheet.mergeCells(`E${firmas}:I${firmas}`);
  sheet.getCell(`E${firmas}`).value = "ENTREGADO POR: _______________________________";
  sheet.mergeCells(`J${firmas}:Q${firmas}`);
  sheet.getCell(`J${firmas}`).value = "RECIBIDO POR: _______________________________";
  sheet.getCell(`A${firmas + 1}`).value =
    `Fecha de elaboración: ${data.header.elaborationDate.toLocaleDateString("es-CO")} · Unidades: ${data.header.unitCount} · SIGAF`;
  sheet.getCell(`A${firmas + 1}`).font = { italic: true, size: 8, name: "Calibri" };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** FUID oficial AGN — Acuerdo 001 de 2024, Anexo 3 (PDF). */
export async function exportFuidPdf(user: SessionUser, opts?: FuidExportOpts) {
  const data = await loadFuidData(user, opts);
  return buildFuidPdfBuffer(data);
}
