import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { SessionUser } from "@/shared/kernel/types";
import { buildBoxQrPayload, buildExpedienteQrPayload } from "@/shared/kernel/qr-codes";
import { getExpedienteArchivalDetail } from "./expediente-archival-service";
import { finalDispositionLabel } from "@/modules/archival-instruments";

/** Medidas estándar COOTRANSHUILA (mm) — etiquetas adhesivas archivo de gestión. */
const FOLDER_SIZE: [number, number] = [100, 140];
const BOX_SIZE: [number, number] = [100, 150];
const MARGIN = 4;
const HEADER_H = 12;
const ACCENT = { r: 0, g: 82, b: 73 };
const LINE_H = 3.6;
const ROW_PAD = 1.8;

type LabelField = { label: string; value: string };

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO");
}

function fmtFolioRange(start?: number | null, end?: number | null) {
  if (start && end) {
    return `${String(start).padStart(3, "0")} – ${String(end).padStart(3, "0")}`;
  }
  return "—";
}

function drawLabelFrame(doc: jsPDF, w: number, h: number) {
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, MARGIN, w - MARGIN * 2, h - MARGIN * 2);
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(MARGIN, MARGIN, w - MARGIN * 2, HEADER_H, "F");
}

function drawOrgHeader(doc: jsPDF, w: number, org: string) {
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(org.toUpperCase(), w / 2, MARGIN + 8, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

/** Ancho de columna de etiquetas según el texto más largo (evita solapes). */
function labelColumnWidth(doc: jsPDF, fields: LabelField[]) {
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  let max = 0;
  for (const f of fields) {
    max = Math.max(max, doc.getTextWidth(`${f.label}:`));
  }
  return Math.min(Math.ceil(max) + 2, 38);
}

/**
 * Filas alineadas: etiqueta fija a la izquierda, valor a la derecha,
 * separadores horizontales a altura uniforme.
 */
function drawFieldRows(
  doc: jsPDF,
  w: number,
  startY: number,
  fields: LabelField[],
  maxY: number
) {
  const labelW = labelColumnWidth(doc, fields);
  const left = MARGIN + 2.5;
  const valueX = left + labelW + 1.5;
  const valueW = w - MARGIN - 2.5 - valueX;
  let y = startY;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(field.value || "—", valueW) as string[];
    const rowH = Math.max(LINE_H + ROW_PAD, lines.length * LINE_H + ROW_PAD);

    if (y + rowH > maxY) break;

    const textY = y + LINE_H;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 65, 70);
    doc.text(`${field.label}:`, left, textY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(lines, valueX, textY);

    y += rowH;
    if (i < fields.length - 1) {
      doc.setDrawColor(210, 215, 220);
      doc.setLineWidth(0.15);
      doc.line(left, y - 0.4, w - MARGIN - 2.5, y - 0.4);
    }
  }

  doc.setTextColor(0, 0, 0);
  return y;
}

function drawTitleBlock(
  doc: jsPDF,
  w: number,
  title: string,
  subtitle: string
) {
  const y0 = MARGIN + HEADER_H;
  doc.setFillColor(248, 250, 249);
  doc.rect(MARGIN, y0, w - MARGIN * 2, 14, "F");
  doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y0 + 14, w - MARGIN, y0 + 14);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.text(title, w / 2, y0 + 6.5, { align: "center" });

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70, 80, 85);
  doc.text(subtitle, w / 2, y0 + 11.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  return y0 + 16;
}

function drawQrBlock(
  doc: jsPDF,
  w: number,
  h: number,
  qrDataUrl: string,
  caption: string,
  qrSize: number
) {
  const footerH = 7;
  const qrY = h - MARGIN - footerH - qrSize - 6;
  const qrX = (w - qrSize) / 2;

  doc.setDrawColor(200, 205, 210);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 3, qrY - 2.5, w - MARGIN - 3, qrY - 2.5);

  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(caption, w / 2, qrY + qrSize + 3.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  return qrY - 3;
}

function drawFooterBand(doc: jsPDF, w: number, h: number, text: string) {
  const bandH = 7;
  const y = h - MARGIN - bandH;
  doc.setFillColor(245, 247, 250);
  doc.rect(MARGIN, y, w - MARGIN * 2, bandH, "F");
  doc.setDrawColor(200, 205, 210);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, w - MARGIN, y);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(text, w / 2, y + 4.5, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

export async function generateFolderLabelPdf(user: SessionUser, expedienteId: string) {
  const exp = await getExpedienteArchivalDetail(user, expedienteId);
  if (!exp) throw new Error("Expediente no encontrado");

  const [w, h] = FOLDER_SIZE;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: FOLDER_SIZE });
  const org = exp.organization?.name ?? "COOTRANSHUILA";

  drawLabelFrame(doc, w, h);
  drawOrgHeader(doc, w, org);

  const fieldsStart = drawTitleBlock(
    doc,
    w,
    exp.code,
    "ETIQUETA DE CARPETA — ARCHIVO DE GESTIÓN"
  );

  const dateRange =
    exp.dateStart || exp.dateEnd
      ? `${fmtDate(exp.dateStart)} – ${fmtDate(exp.dateEnd)}`
      : "—";

  const fields: LabelField[] = [
    { label: "SECCIÓN", value: exp.dependency.name },
    { label: "SUBSECCIÓN", value: exp.subsection ?? exp.dependency.name },
    { label: "SERIE", value: exp.series?.name ?? "—" },
    { label: "SUBSERIE", value: exp.subseries?.name ?? "—" },
    { label: "EXPEDIENTE", value: exp.code },
    { label: "ASUNTO", value: exp.subject ?? exp.name },
    { label: "CARPETA", value: exp.folderNumber ?? "01" },
    { label: "FOLIOS", value: fmtFolioRange(exp.folioStart, exp.folioEnd) },
    { label: "FECHAS", value: dateRange },
    { label: "CAJA", value: exp.boxCode ?? "—" },
  ];

  if (exp.appliedRetentionMgmt != null) {
    fields.push({
      label: "RETENCIÓN",
      value: `AG ${exp.appliedRetentionMgmt} / AC ${exp.appliedRetentionCentral ?? "—"} años`,
    });
  }
  if (exp.appliedFinalDisposition) {
    fields.push({
      label: "DISPOSICIÓN",
      value: finalDispositionLabel(exp.appliedFinalDisposition),
    });
  }

  const qrPayload = buildExpedienteQrPayload(exp.code);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 128, margin: 1, errorCorrectionLevel: "M" });
  const qrSize = 22;
  const fieldsMaxY = drawQrBlock(doc, w, h, qrDataUrl, exp.code, qrSize);

  drawFieldRows(doc, w, fieldsStart, fields, fieldsMaxY);
  drawFooterBand(doc, w, h, `SIGAF · ${new Date().toLocaleDateString("es-CO")} · ${org}`);

  return Buffer.from(doc.output("arraybuffer"));
}

export async function generateBoxLabelPdf(
  user: SessionUser,
  params: {
    boxCode: string;
    section: string;
    subsection: string;
    series?: string;
    subseries?: string;
    expedienteCode?: string;
    folderRange: string;
    dateRange: string;
    organizationName?: string;
    qrPayload?: string;
    retentionLabel?: string;
  }
) {
  const [w, h] = BOX_SIZE;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: BOX_SIZE });
  const org = params.organizationName ?? "COOTRANSHUILA";

  drawLabelFrame(doc, w, h);
  drawOrgHeader(doc, w, org);

  const fieldsStart = drawTitleBlock(
    doc,
    w,
    `CAJA No. ${params.boxCode}`,
    "ETIQUETA DE CAJA — ARCHIVO DE GESTIÓN"
  );

  const fields: LabelField[] = [
    { label: "SECCIÓN", value: params.section },
    { label: "UBICACIÓN", value: params.subsection },
    { label: "SERIE", value: params.series ?? "—" },
    { label: "SUBSERIE", value: params.subseries ?? "—" },
    { label: "CÓDIGO", value: params.expedienteCode ?? params.boxCode },
    { label: "CARPETAS", value: params.folderRange },
    { label: "FECHAS", value: params.dateRange },
  ];
  if (params.retentionLabel) {
    fields.push({ label: "RETENCIÓN", value: params.retentionLabel });
  }

  const qrPayload = params.qrPayload ?? buildBoxQrPayload(params.boxCode);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 140,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const qrSize = 30;
  const fieldsMaxY = drawQrBlock(doc, w, h, qrDataUrl, params.boxCode, qrSize);

  drawFieldRows(doc, w, fieldsStart, fields, fieldsMaxY);
  drawFooterBand(doc, w, h, `SIGAF · ${new Date().toLocaleDateString("es-CO")} · ${org}`);

  return Buffer.from(doc.output("arraybuffer"));
}

export { finalDispositionLabel };
