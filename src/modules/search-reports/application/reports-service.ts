import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { documentScope } from "@/modules/documents";

export type ReportType = "documents" | "expedientes" | "loans" | "audit";
export type ReportFormat = "xlsx" | "pdf" | "csv";

function deptFilter(user: SessionUser) {
  return user.roleCode === "DEPT_HEAD" && user.dependencyId
    ? { dependencyId: user.dependencyId }
    : {};
}

export async function fetchReportRows(user: SessionUser, type: ReportType) {
  const orgId = user.organizationId;
  const dep = deptFilter(user);

  switch (type) {
    case "documents": {
      const rows = await prisma.document.findMany({
        where: documentScope(user),
        include: { dependency: true, series: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      return {
        title: "Inventario de documentos",
        headers: ["Código", "Nombre", "Dependencia", "Serie", "Estado", "Folios", "Fecha"],
        rows: rows.map((d) => [
          d.code,
          d.name,
          d.dependency.name,
          d.series?.name ?? "",
          d.status,
          String(d.folioCount),
          d.createdAt.toISOString().slice(0, 10),
        ]),
      };
    }
    case "expedientes": {
      const rows = await prisma.expediente.findMany({
        where: { organizationId: orgId, deletedAt: null, ...dep },
        include: { dependency: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      return {
        title: "Expedientes activos",
        headers: ["Código", "Nombre", "Dependencia", "Estado", "Apertura"],
        rows: rows.map((e) => [
          e.code,
          e.name,
          e.dependency.name,
          e.status,
          e.openedAt.toISOString().slice(0, 10),
        ]),
      };
    }
    case "loans": {
      const rows = await prisma.loan.findMany({
        where: {
          organizationId: orgId,
          status: { in: ["ACTIVE", "APPROVED", "OVERDUE", "REQUESTED"] },
          ...(user.roleCode === "DEPT_HEAD" && user.dependencyId
            ? { document: { dependencyId: user.dependencyId } }
            : {}),
        },
        include: { document: true, requester: true },
        orderBy: { dueDate: "asc" },
        take: 5000,
      });
      return {
        title: "Préstamos pendientes",
        headers: ["Código", "Documento", "Solicitante", "Estado", "Vence"],
        rows: rows.map((l) => [
          l.code,
          l.document.name,
          `${l.requester.firstName} ${l.requester.lastName}`,
          l.status,
          l.dueDate ? l.dueDate.toISOString().slice(0, 10) : "",
        ]),
      };
    }
    case "audit": {
      const since = new Date();
      since.setMonth(since.getMonth() - 1);
      const rows = await prisma.auditLog.findMany({
        where: { organizationId: orgId, createdAt: { gte: since } },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      return {
        title: "Auditoría mensual",
        headers: ["Fecha", "Usuario", "Acción", "Módulo", "IP"],
        rows: rows.map((a) => [
          a.createdAt.toISOString(),
          a.user ? `${a.user.firstName} ${a.user.lastName}` : "Sistema",
          a.action,
          a.module,
          a.ipAddress ?? "",
        ]),
      };
    }
  }
}

export async function buildExcelBuffer(
  title: string,
  headers: string[],
  rows: string[][]
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGAF";
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = 18;
  });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildCsv(headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  return Buffer.from(lines.join("\n"), "utf8");
}

export function buildPdfBuffer(title: string, headers: string[], rows: string[][]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString("es-CO")} · SIGAF`, 14, 22);

  const startY = 30;
  const colW = (doc.internal.pageSize.getWidth() - 28) / headers.length;
  let y = startY;

  doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => {
    doc.text(String(h).slice(0, 24), 14 + i * colW, y);
  });
  y += 6;
  doc.setFont("helvetica", "normal");

  const maxRows = Math.min(rows.length, 40);
  for (let r = 0; r < maxRows; r++) {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
    rows[r].forEach((cell, i) => {
      doc.text(String(cell).slice(0, 28), 14 + i * colW, y);
    });
    y += 5.5;
  }

  if (rows.length > maxRows) {
    y += 4;
    doc.text(`… y ${rows.length - maxRows} filas más (use Excel para el listado completo)`, 14, y);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export async function importDocumentsFromExcel(user: SessionUser, buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  // exceljs accepts Buffer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("El archivo Excel no tiene hojas");

  const headerRow = sheet.getRow(1);
  const headers: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const key = String(cell.value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    headers[key] = col;
  });

  const col = (...names: string[]) => {
    for (const n of names) {
      if (headers[n] != null) return headers[n];
    }
    return null;
  };

  const nameCol = col("nombre", "name", "documento");
  const depCol = col("dependencia", "dependency", "area");
  const codeCol = col("codigo", "código", "code");
  const folioCol = col("folios", "folio", "folioCount".toLowerCase());
  const obsCol = col("observaciones", "observations", "obs");

  if (!nameCol || !depCol) {
    throw new Error(
      'El Excel debe tener columnas "Nombre" y "Dependencia" (opcional: Código, Folios, Observaciones)'
    );
  }

  const deps = await prisma.dependency.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
  });
  const depByName = new Map(deps.map((d) => [d.name.toLowerCase(), d]));
  const depByCode = new Map(deps.map((d) => [d.code.toLowerCase(), d]));

  const { createDocument } = await import("@/modules/documents");
  const created: string[] = [];
  const errors: string[] = [];

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const name = String(row.getCell(nameCol).value ?? "").trim();
    if (!name) continue;

    const depRaw = String(row.getCell(depCol).value ?? "").trim();
    const dep =
      depByName.get(depRaw.toLowerCase()) || depByCode.get(depRaw.toLowerCase());
    if (!dep) {
      errors.push(`Fila ${i}: dependencia "${depRaw}" no encontrada`);
      continue;
    }

    if (user.roleCode === "DEPT_HEAD" && user.dependencyId && dep.id !== user.dependencyId) {
      errors.push(`Fila ${i}: sin permiso sobre dependencia ${depRaw}`);
      continue;
    }

    const codeVal = codeCol ? String(row.getCell(codeCol).value ?? "").trim() : "";
    const folioVal = folioCol ? Number(row.getCell(folioCol).value ?? 1) : 1;
    const obsVal = obsCol ? String(row.getCell(obsCol).value ?? "").trim() : "";

    try {
      const doc = await createDocument(user, {
        name,
        dependencyId: dep.id,
        code: codeVal || undefined,
        folioCount: Number.isFinite(folioVal) && folioVal > 0 ? folioVal : 1,
        observations: obsVal || undefined,
      });
      created.push(doc.code);
    } catch (e) {
      errors.push(`Fila ${i}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return { created: created.length, codes: created.slice(0, 20), errors };
}

export async function buildImportTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Documentos");
  ws.addRow(["Código", "Nombre", "Dependencia", "Folios", "Observaciones"]);
  ws.getRow(1).font = { bold: true };
  ws.addRow(["", "Contrato ejemplo", "Jurídica", 5, "Importado desde Excel"]);
  ws.addRow(["", "Acta de reunión", "Gerencia", 2, ""]);
  ["A", "B", "C", "D", "E"].forEach((c, i) => {
    ws.getColumn(i + 1).width = c === "B" || c === "E" ? 32 : 16;
  });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
