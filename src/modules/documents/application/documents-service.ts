import { randomBytes } from "crypto";
import { DocumentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";

export function documentScope(user: SessionUser): Prisma.DocumentWhereInput {
  const where: Prisma.DocumentWhereInput = {
    organizationId: user.organizationId,
    deletedAt: null,
  };
  if (
    (user.roleCode === "DEPT_HEAD" || user.roleCode === "DEPT_WORKER") &&
    user.dependencyId
  ) {
    where.dependencyId = user.dependencyId;
  }
  return where;
}

export async function generateDocumentCode(
  orgId: string,
  opts?: { dependencyId?: string; seriesId?: string }
): Promise<string> {
  const entropy = randomBytes(2).toString("hex");

  if (opts?.dependencyId) {
    const dep = await prisma.dependency.findFirst({
      where: { id: opts.dependencyId, organizationId: orgId },
    });
    let seriesCode = "00";
    if (opts.seriesId) {
      const series = await prisma.documentarySeries.findFirst({
        where: { id: opts.seriesId, organizationId: orgId },
      });
      if (series) seriesCode = series.code;
    }
    const year = new Date().getFullYear();
    const prefix = `${dep?.code ?? "00"}-${seriesCode}-${year}-`;
    const last = await prisma.document.findFirst({
      where: { organizationId: orgId, code: { startsWith: prefix } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    let seq = 1;
    if (last?.code) {
      const num = parseInt(last.code.slice(prefix.length).split("-")[0], 10);
      if (!Number.isNaN(num)) seq = num + 1;
    }
    // Sufijo aleatorio evita colisiones en creación concurrente
    return `${prefix}${String(seq).padStart(5, "0")}-${entropy}`;
  }

  const year = new Date().getFullYear();
  const prefix = `DOC-${year}-`;
  const last = await prisma.document.findFirst({
    where: { organizationId: orgId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let seq = 1;
  if (last?.code) {
    const num = parseInt(last.code.slice(prefix.length).split("-")[0], 10);
    if (!Number.isNaN(num)) seq = num + 1;
  }
  return `${prefix}${String(seq).padStart(5, "0")}-${entropy}`;
}

export function generateQrCode(): string {
  return `QR-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export function buildSearchText(fields: {
  name: string;
  code: string;
  observations?: string | null;
}) {
  return [fields.name, fields.code, fields.observations].filter(Boolean).join(" ").toLowerCase();
}

export async function listDocuments(params: {
  user: SessionUser;
  cursor?: string | null;
  q?: string | null;
  status?: DocumentStatus | null;
  dependencyId?: string | null;
  take?: number;
}) {
  const take = params.take ?? 20;
  const where: Prisma.DocumentWhereInput = { ...documentScope(params.user) };

  if (params.q) {
    where.searchText = { contains: params.q.toLowerCase(), mode: "insensitive" };
  }
  if (params.status) where.status = params.status;
  if (params.dependencyId) where.dependencyId = params.dependencyId;

  const items = await prisma.document.findMany({
    where,
    take: take + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { dependency: true, expediente: true, documentType: true },
  });

  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  return {
    items: page,
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    hasMore,
  };
}

export async function createDocument(
  user: SessionUser,
  data: {
    name: string;
    dependencyId: string;
    code?: string;
    folioCount: number;
    observations?: string;
    seriesId?: string;
    subseriesId?: string;
    documentTypeId?: string;
  }
) {
  const code =
    data.code ??
    (await generateDocumentCode(user.organizationId, {
      dependencyId: data.dependencyId,
      seriesId: data.seriesId,
    }));
  let qrCode = generateQrCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.document.findUnique({ where: { qrCode } });
    if (!exists) break;
    qrCode = generateQrCode();
  }

  const doc = await prisma.document.create({
    data: {
      organizationId: user.organizationId,
      dependencyId: data.dependencyId,
      seriesId: data.seriesId,
      subseriesId: data.subseriesId,
      documentTypeId: data.documentTypeId,
      code,
      qrCode,
      name: data.name,
      folioCount: data.folioCount,
      observations: data.observations,
      searchText: buildSearchText({ name: data.name, code, observations: data.observations }),
      responsibleId: user.id,
      submittedById: user.id,
      status:
        user.roleCode === "DEPT_WORKER" || user.roleCode === "DEPT_HEAD"
          ? "PENDING_REVIEW"
          : "ARCHIVED",
      submittedAt:
        user.roleCode === "DEPT_WORKER" || user.roleCode === "DEPT_HEAD"
          ? new Date()
          : undefined,
      archivedAt:
        user.roleCode === "DEPT_WORKER" || user.roleCode === "DEPT_HEAD"
          ? undefined
          : new Date(),
    },
    include: { dependency: true },
  });

  if (data.seriesId || data.subseriesId) {
    try {
      const { applyTrdCalculationToDocument } = await import(
        "@/modules/archival-instruments/application/trd-crud-service"
      );
      await applyTrdCalculationToDocument(user, doc.id);
    } catch {
      // no bloquear creación si falla el cálculo TRD
    }
  }

  return prisma.document.findUniqueOrThrow({
    where: { id: doc.id },
    include: { dependency: true },
  });
}

export async function getDocument(user: SessionUser, id: string) {
  return prisma.document.findFirst({
    where: { id, ...documentScope(user) },
    include: {
      dependency: true,
      expediente: true,
      documentType: true,
      folder: true,
      series: true,
      versions: { orderBy: { version: "desc" }, include: { createdBy: true } },
      attachments: { orderBy: { createdAt: "desc" } },
      responsible: true,
      submittedBy: true,
      subseries: true,
      workflowEvents: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
}

export async function addDocumentVersion(
  user: SessionUser,
  documentId: string,
  file: { relativePath: string; hash: string; changeNote?: string }
) {
  const doc = await getDocument(user, documentId);
  if (!doc) return null;
  if (user.roleCode === "CONSULT_USER") throw new Error("Sin permiso");

  const last = await prisma.documentVersion.findFirst({
    where: { documentId },
    orderBy: { version: "desc" },
  });
  const version = (last?.version ?? 0) + 1;

  const [created] = await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId,
        version,
        filePath: file.relativePath,
        fileHash: file.hash,
        changeNote: file.changeNote,
        createdById: user.id,
      },
      include: { createdBy: true },
    }),
    prisma.document.update({
      where: { id: documentId },
      data: {
        filePath: file.relativePath,
        fileHash: file.hash,
      },
    }),
  ]);

  return created;
}

export async function addDocumentAttachment(
  user: SessionUser,
  documentId: string,
  file: {
    name: string;
    relativePath: string;
    mimeType?: string;
    sizeBytes?: number;
  }
) {
  const doc = await getDocument(user, documentId);
  if (!doc) return null;
  if (user.roleCode === "CONSULT_USER") throw new Error("Sin permiso");

  return prisma.documentAttachment.create({
    data: {
      documentId,
      name: file.name,
      filePath: file.relativePath,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    },
  });
}

export async function updateDocument(
  user: SessionUser,
  id: string,
  data: Partial<{ name: string; status: DocumentStatus; folioCount: number; observations: string }>
) {
  const existing = await getDocument(user, id);
  if (!existing) return null;

  const name = data.name ?? existing.name;
  const code = existing.code;
  const observations = data.observations ?? existing.observations;

  return prisma.document.update({
    where: { id },
    data: {
      ...data,
      searchText: buildSearchText({ name, code, observations }),
    },
    include: { dependency: true },
  });
}

export async function softDeleteDocument(user: SessionUser, id: string) {
  const doc = await getDocument(user, id);
  if (!doc) return null;

  await prisma.$transaction([
    prisma.document.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DELETED" },
    }),
    prisma.recycleBinItem.create({
      data: {
        entityType: "Document",
        entityId: id,
        payload: doc as object,
        deletedBy: user.id,
      },
    }),
  ]);

  return doc;
}

export async function searchDocuments(user: SessionUser, q: string, take = 30) {
  const scope = documentScope(user);
  return prisma.document.findMany({
    where: {
      ...scope,
      OR: [
        { searchText: { contains: q.toLowerCase(), mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { qrCode: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
    orderBy: { updatedAt: "desc" },
    include: { dependency: true },
  });
}
