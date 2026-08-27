import { DocumentSupport, DocumentStatus, Prisma, RetentionStartEvent } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";
import {
  evaluateExpedienteReadiness,
  inferElectronicFormat,
  inferSupportFromFile,
  type ExpedienteReadiness,
} from "@/shared/kernel/expediente-cycle";
import { parseProcessSteps } from "@/shared/kernel/archival-process";
import {
  buildSearchText,
  generateDocumentCode,
  generateQrCode,
} from "@/modules/documents/application/documents-service";
import {
  expedienteScope,
  getExpediente,
} from "./expedientes-service";
import { applyExpedienteRetentionPolicy } from "./expediente-archival-service";

async function nextSortOrder(expedienteId: string) {
  const max = await prisma.document.aggregate({
    where: { expedienteId, deletedAt: null },
    _max: { sortOrder: true },
  });
  return (max._max.sortOrder ?? 0) + 1;
}

async function refreshExpedienteDates(expedienteId: string) {
  const docs = await prisma.document.findMany({
    where: { expedienteId, deletedAt: null, documentDate: { not: null } },
    select: { documentDate: true },
    orderBy: { documentDate: "asc" },
  });
  if (!docs.length) return;
  const start = docs[0].documentDate!;
  const end = docs[docs.length - 1].documentDate!;
  await prisma.expediente.update({
    where: { id: expedienteId },
    data: { dateStart: start, dateEnd: end },
  });
}

export async function applyRetentionFromEvent(
  expedienteId: string,
  event: RetentionStartEvent,
  contextDate: Date
) {
  return applyExpedienteRetentionPolicy(expedienteId, event, {
    explicitDate: contextDate,
    closedAt: event === "EXPEDIENTE_CLOSE" ? contextDate : null,
  });
}

export async function addDocumentToExpediente(
  user: SessionUser,
  expedienteId: string,
  data: {
    name: string;
    description?: string;
    documentTypeId?: string;
    folioCount?: number;
    documentDate?: string;
    observations?: string;
    support?: DocumentSupport;
    electronicFormat?: string;
    fileName?: string;
  }
) {
  const exp = await prisma.expediente.findFirst({
    where: { id: expedienteId, ...expedienteScope(user) },
    include: {
      documents: { where: { deletedAt: null } },
      series: { select: { id: true, seriesKind: true, name: true } },
    },
  });
  if (!exp) throw new AppError("Expediente no encontrado", 404);
  if (exp.status === "CLOSED") throw new AppError("El expediente está cerrado", 400);

  if (data.documentTypeId && exp.series?.seriesKind === "SIMPLE" && exp.documents.length > 0) {
    const existingTypes = new Set(
      exp.documents.map((d) => d.documentTypeId).filter(Boolean)
    );
    if (existingTypes.size > 0 && !existingTypes.has(data.documentTypeId)) {
      throw new AppError(
        "Serie simple TRD: no puede agregar tipos documentales distintos en el mismo expediente",
        400
      );
    }
  }

  const support = inferSupportFromFile(!!data.fileName, data.support);
  const electronicFormat =
    data.electronicFormat ?? (data.fileName ? inferElectronicFormat(data.fileName) : undefined);

  const code = await generateDocumentCode(user.organizationId, {
    dependencyId: exp.dependencyId,
    seriesId: exp.seriesId ?? undefined,
  });
  let qrCode = generateQrCode();
  for (let i = 0; i < 5; i++) {
    if (!(await prisma.document.findUnique({ where: { qrCode } }))) break;
    qrCode = generateQrCode();
  }

  const sortOrder = await nextSortOrder(expedienteId);
  const docDate = data.documentDate ? new Date(data.documentDate) : new Date();

  const doc = await prisma.document.create({
    data: {
      organizationId: user.organizationId,
      dependencyId: exp.dependencyId,
      expedienteId: exp.id,
      seriesId: exp.seriesId,
      subseriesId: exp.subseriesId,
      documentTypeId: data.documentTypeId,
      code,
      qrCode,
      name: data.name,
      description: data.description,
      folioCount: data.folioCount ?? 1,
      observations: data.observations,
      documentDate: docDate,
      support,
      electronicFormat,
      sortOrder,
      searchText: buildSearchText({ name: data.name, code, observations: data.observations }),
      responsibleId: user.id,
      submittedById: user.id,
      status: "ACTIVE" as DocumentStatus,
      submittedAt: new Date(),
    },
  });

  const steps = parseProcessSteps(exp.processSteps);
  if (exp.documents.length === 0) steps.ORDERING = true;

  await prisma.expediente.update({
    where: { id: exp.id },
    data: {
      processSteps: steps as Prisma.InputJsonValue,
      chronologicalOrder: exp.documents.length > 0 ? exp.chronologicalOrder : true,
    },
  });

  await refreshExpedienteDates(exp.id);

  if (exp.retentionStartEvent === "LAST_DOCUMENT") {
    await applyRetentionFromEvent(exp.id, "LAST_DOCUMENT", docDate);
  }

  try {
    const { applyTrdCalculationToDocument } = await import(
      "@/modules/archival-instruments/application/trd-crud-service"
    );
    await applyTrdCalculationToDocument(user, doc.id);
  } catch {
    /* opcional */
  }

  return doc;
}

export async function closeExpediente(user: SessionUser, expedienteId: string) {
  const exp = await getExpediente(user, expedienteId);
  if (!exp) throw new AppError("Expediente no encontrado", 404);
  if (exp.status === "CLOSED") throw new AppError("El expediente ya está cerrado", 400);

  const docCount = await prisma.document.count({
    where: { expedienteId, deletedAt: null },
  });
  if (docCount === 0) throw new AppError("No puede cerrar un expediente sin documentos", 400);

  const closedAt = new Date();
  const event = exp.retentionStartEvent ?? "EXPEDIENTE_CLOSE";
  await applyRetentionFromEvent(expedienteId, event, closedAt);

  return prisma.expediente.update({
    where: { id: expedienteId },
    data: { status: "CLOSED", closedAt },
  });
}

export async function markExpedienteFuidComplete(user: SessionUser, expedienteIds: string[]) {
  for (const id of expedienteIds) {
    const exp = await getExpediente(user, id);
    if (!exp) continue;
    const steps = parseProcessSteps(exp.processSteps);
    steps.FUID_INVENTORY = true;
    await prisma.expediente.update({
      where: { id },
      data: { processSteps: steps as Prisma.InputJsonValue },
    });
  }
}

export async function getExpedienteReadiness(
  user: SessionUser,
  expedienteId: string
): Promise<ExpedienteReadiness | null> {
  const list = await listExpedientesReadiness(user, [expedienteId]);
  return list[0] ?? null;
}

export async function listExpedientesReadiness(
  user: SessionUser,
  expedienteIds?: string[]
): Promise<ExpedienteReadiness[]> {
  const validatedItems = await prisma.documentInventoryItem.findMany({
    where: {
      inventory: {
        organizationId: user.organizationId,
        status: { in: ["VALIDATED", "SENT"] },
      },
      ...(expedienteIds?.length ? { expedienteId: { in: expedienteIds } } : {}),
    },
    select: { expedienteId: true },
  });
  const validatedSet = new Set(
    validatedItems.map((i) => i.expedienteId).filter(Boolean) as string[]
  );

  const expedientes = await prisma.expediente.findMany({
    where: {
      ...expedienteScope(user),
      deletedAt: null,
      archivalPhase: "MANAGEMENT",
      ...(expedienteIds?.length ? { id: { in: expedienteIds } } : {}),
    },
    include: { documents: { where: { deletedAt: null }, select: { id: true } } },
    orderBy: { code: "asc" },
    take: expedienteIds?.length ? undefined : 100,
  });

  return expedientes.map((e) =>
    evaluateExpedienteReadiness({
      ...e,
      hasValidatedInventory: validatedSet.has(e.id),
    })
  );
}

export async function validateExpedientesForPrimaryTransfer(
  user: SessionUser,
  expedienteIds: string[]
) {
  const readiness = await listExpedientesReadiness(user, expedienteIds);
  const notReady = readiness.filter((r) => !r.ready);
  if (notReady.length) {
    const details = notReady
      .map((r) => `${r.code}: ${r.checks.filter((c) => !c.passed).map((c) => c.label).join(", ")}`)
      .join("; ");
    throw new AppError(`Expedientes no listos para transferencia: ${details}`, 400);
  }
  return readiness;
}

export { evaluateExpedienteReadiness };
