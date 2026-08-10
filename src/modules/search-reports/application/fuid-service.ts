import ExcelJS from "exceljs";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";

/** Inventario FUID simplificado (plantilla AGN). */
export async function exportFuidExcel(user: SessionUser, dependencyId?: string) {
  const docs = await prisma.document.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      ...(dependencyId ? { dependencyId } : {}),
      ...(user.dependencyId &&
      (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER")
        ? { dependencyId: user.dependencyId }
        : {}),
    },
    include: {
      dependency: true,
      series: true,
      subseries: true,
      folder: { include: { box: { include: { location: true } } } },
      expediente: true,
    },
    orderBy: [{ dependencyId: "asc" }, { code: "asc" }],
    take: 5000,
  });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("FUID");
  sheet.addRow([
    "Fondo / Dependencia",
    "Sección (código dep.)",
    "Serie",
    "Subserie",
    "Código documento",
    "Nombre / Asunto",
    "Expediente",
    "Fecha",
    "Folios",
    "Soporte",
    "Ubicación física",
    "Caja",
    "Carpeta",
    "Fase",
    "Disposición",
  ]);

  for (const d of docs) {
    sheet.addRow([
      d.dependency.name,
      d.dependency.code,
      d.series ? `${d.series.code} ${d.series.name}` : "",
      d.subseries ? `${d.subseries.code} ${d.subseries.name}` : "",
      d.code,
      d.name,
      d.expediente?.code ?? "",
      d.documentDate?.toISOString().slice(0, 10) ?? "",
      d.folioCount,
      d.filePath ? "Electrónico" : "Físico",
      d.folder?.box?.location?.name ?? "",
      d.folder?.box?.code ?? "",
      d.folder?.code ?? "",
      d.archivalPhase,
      d.appliedFinalDisposition ?? "",
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
