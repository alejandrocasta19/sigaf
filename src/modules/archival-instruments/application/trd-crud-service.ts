import ExcelJS from "exceljs";
import { FinalDisposition, Prisma, SeriesKind } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import {
  documentaryValuesLabel,
  finalDispositionLabel,
  getActiveTrd,
  listTrdTable,
} from "./trd-service";

function assertTrdAdmin(user: SessionUser) {
  if (!["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode)) {
    throw new AppError("Sin permiso para administrar la TRD", 403);
  }
}

export type SeriesInput = {
  code: string;
  name: string;
  description?: string;
  dependencyId?: string | null;
  retentionManagementYears?: number | null;
  retentionCentralYears?: number | null;
  finalDisposition?: FinalDisposition;
  seriesKind?: SeriesKind;
  valueAdministrative?: boolean;
  valueJuridical?: boolean;
  valueLegal?: boolean;
  valueFiscal?: boolean;
  valueAccounting?: boolean;
  valueHistorical?: boolean;
  procedure?: string;
  active?: boolean;
};

export type SubseriesInput = {
  code: string;
  name: string;
  description?: string;
  retentionManagementYears?: number | null;
  retentionCentralYears?: number | null;
  finalDisposition?: FinalDisposition | null;
  valueAdministrative?: boolean;
  valueJuridical?: boolean;
  valueLegal?: boolean;
  valueFiscal?: boolean;
  valueAccounting?: boolean;
  valueHistorical?: boolean;
};

export type TypologyInput = {
  code: string;
  name: string;
  description?: string;
  active?: boolean;
};

/** Reglas informativas (referencia). La retención aplicada proviene de la TRD aprobada, no de este cálculo. */
export function calculateRetentionFromValues(values: {
  valueAdministrative?: boolean;
  valueJuridical?: boolean;
  valueLegal?: boolean;
  valueFiscal?: boolean;
  valueAccounting?: boolean;
  valueHistorical?: boolean;
  baseAg?: number | null;
  baseAc?: number | null;
  baseDisposition?: FinalDisposition | null;
}) {
  let ag = values.baseAg ?? 2;
  let ac = values.baseAc ?? 3;
  let disposition: FinalDisposition = values.baseDisposition ?? "ELIMINATION";

  if (values.valueHistorical) {
    disposition = "CONSERVATION";
    ag = Math.max(ag, 5);
    ac = Math.max(ac, 10);
  } else if (values.valueJuridical || values.valueLegal) {
    disposition = disposition === "ELIMINATION" ? "SELECTION" : disposition;
    ag = Math.max(ag, 3);
    ac = Math.max(ac, 7);
  }

  if (values.valueFiscal || values.valueAccounting) {
    ag = Math.max(ag, 2);
    ac = Math.max(ac, 5);
    if (disposition === "ELIMINATION") disposition = "SELECTION";
  }

  if (
    values.valueAdministrative &&
    !values.valueHistorical &&
    !values.valueJuridical &&
    !values.valueLegal &&
    !values.valueFiscal &&
    !values.valueAccounting
  ) {
    disposition = values.baseDisposition ?? "ELIMINATION";
  }

  return {
    retentionManagementYears: ag,
    retentionCentralYears: ac,
    retentionYears: ag + ac,
    finalDisposition: disposition,
  };
}

/** Retención oficial TRD — serie/subserie como fuente única de verdad (sin recalcular por valores documentales). */
export function resolveTrdRetention(params: {
  retentionManagementYears?: number | null;
  retentionCentralYears?: number | null;
  finalDisposition?: FinalDisposition | null;
  seriesFallback?: {
    retentionManagementYears?: number | null;
    retentionCentralYears?: number | null;
    finalDisposition?: FinalDisposition | null;
  };
}): { ag: number; ac: number; disposition: FinalDisposition } {
  const ag =
    params.retentionManagementYears ??
    params.seriesFallback?.retentionManagementYears ??
    2;
  const ac =
    params.retentionCentralYears ??
    params.seriesFallback?.retentionCentralYears ??
    8;
  const disposition =
    params.finalDisposition ??
    params.seriesFallback?.finalDisposition ??
    ("CONSERVATION" as FinalDisposition);
  return { ag, ac, disposition };
}

export async function applyTrdCalculationToDocument(
  user: SessionUser,
  documentId: string
) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId: user.organizationId, deletedAt: null },
    include: { series: true, subseries: true },
  });
  if (!doc) throw new AppError("Documento no encontrado", 404);

  const source = doc.subseries ?? doc.series;
  if (!source) throw new AppError("El documento no tiene serie/subserie TRD", 400);

  const retention = resolveTrdRetention({
    retentionManagementYears: source.retentionManagementYears,
    retentionCentralYears: source.retentionCentralYears,
    finalDisposition:
      ("finalDisposition" in source && source.finalDisposition) ||
      doc.series?.finalDisposition ||
      null,
    seriesFallback: doc.series
      ? {
          retentionManagementYears: doc.series.retentionManagementYears,
          retentionCentralYears: doc.series.retentionCentralYears,
          finalDisposition: doc.series.finalDisposition,
        }
      : undefined,
  });

  const baseDate = doc.documentDate ?? doc.archivedAt ?? doc.createdAt;
  const due = new Date(baseDate);
  due.setFullYear(due.getFullYear() + retention.ag + retention.ac);

  return prisma.document.update({
    where: { id: doc.id },
    data: {
      appliedRetentionMgmt: retention.ag,
      appliedRetentionCentral: retention.ac,
      appliedFinalDisposition: retention.disposition,
      retentionDueAt: due,
    },
  });
}

export async function createSeries(user: SessionUser, data: SeriesInput) {
  assertTrdAdmin(user);
  const trd = await getActiveTrd(user);
  const ag = data.retentionManagementYears ?? 2;
  const ac = data.retentionCentralYears ?? 8;

  const series = await prisma.documentarySeries.create({
    data: {
      organizationId: user.organizationId,
      instrumentId: trd?.id,
      dependencyId: data.dependencyId || null,
      code: data.code.trim(),
      name: data.name.trim(),
      description: data.description,
      procedure: data.procedure,
      retentionManagementYears: ag,
      retentionCentralYears: ac,
      retentionYears: ag + ac,
      finalDisposition: data.finalDisposition ?? "CONSERVATION",
      seriesKind: data.seriesKind ?? "COMPOSITE",
      valueAdministrative: !!data.valueAdministrative,
      valueJuridical: !!data.valueJuridical,
      valueLegal: !!data.valueLegal,
      valueFiscal: !!data.valueFiscal,
      valueAccounting: !!data.valueAccounting,
      valueHistorical: !!data.valueHistorical,
      active: data.active ?? true,
    },
  });

  if (trd) {
    await prisma.archivalInstrument.update({
      where: { id: trd.id },
      data: {
        seriesCount: { increment: 1 },
        lastUpdated: new Date(),
      },
    });
  }
  return series;
}

export async function updateSeries(user: SessionUser, id: string, data: Partial<SeriesInput>) {
  assertTrdAdmin(user);
  const existing = await prisma.documentarySeries.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) throw new AppError("Serie no encontrada", 404);

  const ag = data.retentionManagementYears ?? existing.retentionManagementYears ?? 2;
  const ac = data.retentionCentralYears ?? existing.retentionCentralYears ?? 8;

  return prisma.documentarySeries.update({
    where: { id },
    data: {
      code: data.code?.trim(),
      name: data.name?.trim(),
      description: data.description,
      procedure: data.procedure,
      dependencyId: data.dependencyId === undefined ? undefined : data.dependencyId || null,
      retentionManagementYears: ag,
      retentionCentralYears: ac,
      retentionYears: ag + ac,
      finalDisposition: data.finalDisposition ?? existing.finalDisposition,
      seriesKind: data.seriesKind ?? existing.seriesKind,
      valueAdministrative: data.valueAdministrative,
      valueJuridical: data.valueJuridical,
      valueLegal: data.valueLegal,
      valueFiscal: data.valueFiscal,
      valueAccounting: data.valueAccounting,
      valueHistorical: data.valueHistorical,
      active: data.active,
    },
  });
}

export async function createSubseries(
  user: SessionUser,
  seriesId: string,
  data: SubseriesInput
) {
  assertTrdAdmin(user);
  const series = await prisma.documentarySeries.findFirst({
    where: { id: seriesId, organizationId: user.organizationId },
  });
  if (!series) throw new AppError("Serie no encontrada", 404);

  return prisma.documentarySubseries.create({
    data: {
      seriesId,
      code: data.code.trim(),
      name: data.name.trim(),
      description: data.description,
      retentionManagementYears:
        data.retentionManagementYears ?? series.retentionManagementYears,
      retentionCentralYears: data.retentionCentralYears ?? series.retentionCentralYears,
      finalDisposition: data.finalDisposition ?? series.finalDisposition,
      valueAdministrative: data.valueAdministrative ?? series.valueAdministrative,
      valueJuridical: data.valueJuridical ?? series.valueJuridical,
      valueLegal: data.valueLegal ?? series.valueLegal,
      valueFiscal: data.valueFiscal ?? series.valueFiscal,
      valueAccounting: data.valueAccounting ?? series.valueAccounting,
      valueHistorical: data.valueHistorical ?? series.valueHistorical,
    },
  });
}

export async function updateSubseries(
  user: SessionUser,
  id: string,
  data: Partial<SubseriesInput> & { active?: boolean }
) {
  assertTrdAdmin(user);
  const existing = await prisma.documentarySubseries.findFirst({
    where: { id, series: { organizationId: user.organizationId } },
  });
  if (!existing) throw new AppError("Subserie no encontrada", 404);

  return prisma.documentarySubseries.update({
    where: { id },
    data: {
      code: data.code?.trim(),
      name: data.name?.trim(),
      description: data.description,
      retentionManagementYears: data.retentionManagementYears,
      retentionCentralYears: data.retentionCentralYears,
      finalDisposition: data.finalDisposition,
      valueAdministrative: data.valueAdministrative,
      valueJuridical: data.valueJuridical,
      valueLegal: data.valueLegal,
      valueFiscal: data.valueFiscal,
      valueAccounting: data.valueAccounting,
      valueHistorical: data.valueHistorical,
      active: data.active,
    },
  });
}

export async function createTypology(user: SessionUser, data: TypologyInput) {
  assertTrdAdmin(user);
  return prisma.documentType.create({
    data: {
      organizationId: user.organizationId,
      code: data.code.trim(),
      name: data.name.trim(),
      description: data.description,
      category: "TYPOLOGY",
      active: data.active ?? true,
    },
  });
}

export async function updateTypology(
  user: SessionUser,
  id: string,
  data: Partial<TypologyInput>
) {
  assertTrdAdmin(user);
  const existing = await prisma.documentType.findFirst({
    where: { id, organizationId: user.organizationId, category: "TYPOLOGY" },
  });
  if (!existing) throw new AppError("Tipología no encontrada", 404);
  return prisma.documentType.update({
    where: { id },
    data: {
      code: data.code?.trim(),
      name: data.name?.trim(),
      description: data.description,
      active: data.active,
    },
  });
}

export async function listTypologies(user: SessionUser) {
  return prisma.documentType.findMany({
    where: { organizationId: user.organizationId, category: "TYPOLOGY" },
    orderBy: { code: "asc" },
  });
}

export async function snapshotTrdVersion(
  user: SessionUser,
  version: string,
  notes?: string
) {
  assertTrdAdmin(user);
  const table = await listTrdTable(user);
  const trd = await getActiveTrd(user);
  const snapshot = table.map((s) => ({
    code: s.code,
    name: s.name,
    dependencyCode: s.dependency?.code,
    ag: s.retentionManagementYears,
    ac: s.retentionCentralYears,
    disposition: s.finalDisposition,
    values: documentaryValuesLabel(s),
    subseries: s.subseries.map((sub) => ({
      code: sub.code,
      name: sub.name,
      ag: sub.retentionManagementYears,
      ac: sub.retentionCentralYears,
      disposition: sub.finalDisposition,
    })),
  }));

  const created = await prisma.trdVersion.create({
    data: {
      organizationId: user.organizationId,
      instrumentId: trd?.id,
      version,
      notes,
      snapshot,
      seriesCount: table.length,
      createdById: user.id,
    },
  });

  if (trd) {
    await prisma.archivalInstrument.update({
      where: { id: trd.id },
      data: { version, lastUpdated: new Date(), seriesCount: table.length },
    });
  }
  return created;
}

export async function listTrdVersions(user: SessionUser) {
  return prisma.trdVersion.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function exportTrdExcel(user: SessionUser) {
  const table = await listTrdTable(user);
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGAF TRD";
  const sheet = wb.addWorksheet("TRD");
  sheet.columns = [
    { header: "DepCódigo", key: "dep", width: 10 },
    { header: "DepNombre", key: "depName", width: 24 },
    { header: "Serie", key: "serie", width: 10 },
    { header: "NombreSerie", key: "serieName", width: 28 },
    { header: "Subserie", key: "sub", width: 12 },
    { header: "NombreSubserie", key: "subName", width: 28 },
    { header: "AG", key: "ag", width: 6 },
    { header: "AC", key: "ac", width: 6 },
    { header: "Disposicion", key: "disp", width: 16 },
    { header: "Valores", key: "valores", width: 36 },
  ];

  for (const s of table) {
    if (s.subseries.length === 0) {
      sheet.addRow({
        dep: s.dependency?.code ?? "",
        depName: s.dependency?.name ?? "",
        serie: s.code,
        serieName: s.name,
        sub: "",
        subName: "",
        ag: s.retentionManagementYears ?? "",
        ac: s.retentionCentralYears ?? "",
        disp: s.finalDisposition,
        valores: documentaryValuesLabel(s),
      });
    } else {
      for (const sub of s.subseries) {
        sheet.addRow({
          dep: s.dependency?.code ?? "",
          depName: s.dependency?.name ?? "",
          serie: s.code,
          serieName: s.name,
          sub: sub.code,
          subName: sub.name,
          ag: sub.retentionManagementYears ?? s.retentionManagementYears ?? "",
          ac: sub.retentionCentralYears ?? s.retentionCentralYears ?? "",
          disp: sub.finalDisposition ?? s.finalDisposition,
          valores: documentaryValuesLabel(sub),
        });
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function importTrdExcel(user: SessionUser, buffer: Buffer) {
  assertTrdAdmin(user);
  const wb = new ExcelJS.Workbook();
  // exceljs types expect ArrayBuffer-like
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new AppError("El Excel no tiene hojas", 400);

  const deps = await prisma.dependency.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
  });
  const depByCode = Object.fromEntries(deps.map((d) => [d.code, d]));
  const trd = await getActiveTrd(user);

  let createdSeries = 0;
  let createdSubs = 0;
  const seriesCache = new Map<string, string>();

  const existing = await prisma.documentarySeries.findMany({
    where: { organizationId: user.organizationId },
  });
  for (const s of existing) seriesCache.set(s.code, s.id);

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    // processed async below — collect first
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (i: number) => String(row.getCell(i).value ?? "").trim();
    rows.push({
      dep: get(1),
      serie: get(3),
      serieName: get(4),
      sub: get(5),
      subName: get(6),
      ag: get(7),
      ac: get(8),
      disp: get(9).toUpperCase(),
      valores: get(10).toLowerCase(),
    });
  });

  for (const r of rows) {
    if (!r.serie || !r.serieName) continue;
    const disposition = (
      ["CONSERVATION", "SELECTION", "ELIMINATION", "DIGITALIZATION"].includes(r.disp)
        ? r.disp
        : "SELECTION"
    ) as FinalDisposition;
    const values = {
      valueAdministrative: r.valores.includes("admin"),
      valueJuridical: r.valores.includes("jur"),
      valueLegal: r.valores.includes("legal"),
      valueFiscal: r.valores.includes("fisc"),
      valueAccounting: r.valores.includes("cont"),
      valueHistorical: r.valores.includes("hist"),
    };
    const ag = parseInt(r.ag, 10) || 2;
    const ac = parseInt(r.ac, 10) || 3;

    let seriesId = seriesCache.get(r.serie);
    if (!seriesId) {
      const created = await prisma.documentarySeries.create({
        data: {
          organizationId: user.organizationId,
          instrumentId: trd?.id,
          dependencyId: depByCode[r.dep]?.id,
          code: r.serie,
          name: r.serieName,
          retentionManagementYears: ag,
          retentionCentralYears: ac,
          retentionYears: ag + ac,
          finalDisposition: disposition,
          ...values,
        },
      });
      seriesId = created.id;
      seriesCache.set(r.serie, seriesId);
      createdSeries++;
    }

    if (r.sub && r.subName) {
      const exists = await prisma.documentarySubseries.findFirst({
        where: { seriesId, code: r.sub },
      });
      if (!exists) {
        await prisma.documentarySubseries.create({
          data: {
            seriesId,
            code: r.sub,
            name: r.subName,
            retentionManagementYears: ag,
            retentionCentralYears: ac,
            finalDisposition: disposition,
            ...values,
          },
        });
        createdSubs++;
      }
    }
  }

  await snapshotTrdVersion(
    user,
    `import-${new Date().toISOString().slice(0, 10)}`,
    `Import Excel: +${createdSeries} series, +${createdSubs} subseries`
  );

  return { createdSeries, createdSubs };
}

export { finalDispositionLabel };
