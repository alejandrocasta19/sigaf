import { InventoryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { AppError } from "@/shared/kernel/http";

async function nextInventoryCode(orgId: string) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last = await prisma.documentInventory.findFirst({
    where: { organizationId: orgId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let seq = 1;
  if (last?.code) {
    const n = parseInt(last.code.slice(prefix.length), 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

function buildInventoryItemFromExpediente(
  e: {
    id: string;
    code: string;
    subject: string | null;
    name: string;
    boxCode: string | null;
    folderNumber: string | null;
    dateStart: Date | null;
    dateEnd: Date | null;
    series?: { name: string } | null;
    subseries?: { name: string } | null;
    documents: {
      id: string;
      name: string;
      folioCount: number;
      support: string;
      electronicFormat: string | null;
    }[];
  },
  orderBase: number
): Array<{
  expedienteId: string;
  documentId: string | null;
  orderNumber: number;
  seriesName: string | undefined;
  subseriesName: string | undefined;
  subject: string;
  expedienteCode: string;
  unitName: string;
  dateStart: Date | null;
  dateEnd: Date | null;
  supportPhysical: boolean;
  supportElectronic: boolean;
  boxCode: string | null;
  folderNumber: string | null;
  folioCount: number | null;
  format: string | null;
  quantity: number;
  notes: string | null;
}> {
  const docs = e.documents;
  const hasPhysical = docs.some((d) => d.support === "PHYSICAL" || d.support === "HYBRID") || !docs.length;
  const hasElectronic = docs.some((d) => d.support === "ELECTRONIC" || d.support === "HYBRID");
  const folios = docs.reduce((s, d) => s + (d.folioCount || 0), 0);

  if (docs.length) {
    return docs.map((d, idx) => ({
      expedienteId: e.id,
      documentId: d.id,
      orderNumber: orderBase + idx + 1,
      seriesName: e.series?.name,
      subseriesName: e.subseries?.name,
      subject: e.subject ?? e.name,
      expedienteCode: e.code,
      unitName: d.name,
      dateStart: e.dateStart,
      dateEnd: e.dateEnd,
      supportPhysical: d.support !== "ELECTRONIC",
      supportElectronic: d.support !== "PHYSICAL",
      boxCode: e.boxCode,
      folderNumber: e.folderNumber,
      folioCount: d.folioCount,
      format: d.electronicFormat,
      quantity: 1,
      notes: null as string | null,
    }));
  }

  return [
    {
      expedienteId: e.id,
      documentId: null,
      orderNumber: orderBase + 1,
      seriesName: e.series?.name,
      subseriesName: e.subseries?.name,
      subject: e.subject ?? e.name,
      expedienteCode: e.code,
      unitName: e.subject ?? e.name,
      dateStart: e.dateStart,
      dateEnd: e.dateEnd,
      supportPhysical: hasPhysical,
      supportElectronic: hasElectronic,
      boxCode: e.boxCode,
      folderNumber: e.folderNumber,
      folioCount: folios || null,
      format: null,
      quantity: 1,
      notes: null as string | null,
    },
  ];
}

export async function listDocumentInventories(user: SessionUser) {
  return prisma.documentInventory.findMany({
    where: { organizationId: user.organizationId },
    include: {
      _count: { select: { items: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getDocumentInventory(user: SessionUser, id: string) {
  const inv = await prisma.documentInventory.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      items: { orderBy: [{ orderNumber: "asc" }, { expedienteCode: "asc" }] },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!inv) throw new AppError("Inventario no encontrado", 404);
  return inv;
}

export async function createDocumentInventory(
  user: SessionUser,
  data: {
    title: string;
    transferCode?: string;
    expedienteIds?: string[];
    entitySender?: string;
    entityProducer?: string;
    adminUnit?: string;
    producerOffice?: string;
    objectDescription?: string;
  }
) {
  const code = await nextInventoryCode(user.organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true },
  });

  const expedientes = await prisma.expediente.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      ...(data.expedienteIds?.length ? { id: { in: data.expedienteIds } } : {}),
    },
    include: {
      dependency: { select: { name: true } },
      series: true,
      subseries: true,
      documents: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          folioCount: true,
          support: true,
          electronicFormat: true,
        },
      },
    },
    take: data.expedienteIds?.length ? undefined : 200,
  });

  if (!expedientes.length) throw new AppError("No hay expedientes para inventariar", 400);

  let orderBase = 0;
  const itemRows = expedientes.flatMap((e) => {
    const rows = buildInventoryItemFromExpediente(e, orderBase);
    orderBase += rows.length;
    return rows;
  });

  const inv = await prisma.documentInventory.create({
    data: {
      organizationId: user.organizationId,
      code,
      title: data.title,
      transferCode: data.transferCode,
      entitySender: data.entitySender ?? org?.name,
      entityProducer: data.entityProducer ?? org?.name,
      adminUnit: data.adminUnit ?? expedientes[0]?.dependency?.name,
      producerOffice: data.producerOffice ?? expedientes[0]?.dependency?.name,
      objectDescription: data.objectDescription ?? data.title,
      status: "IN_PREPARATION",
      createdById: user.id,
      items: { create: itemRows },
    },
    include: { items: true },
  });
  return inv;
}

export type InventoryItemUpdate = {
  id: string;
  orderNumber?: number;
  seriesName?: string;
  subseriesName?: string;
  subject?: string;
  expedienteCode?: string;
  unitName?: string;
  dateStart?: string | null;
  dateEnd?: string | null;
  supportPhysical?: boolean;
  supportElectronic?: boolean;
  boxCode?: string;
  folderNumber?: string;
  folioCount?: number | null;
  format?: string;
  quantity?: number | null;
  location?: string;
  notes?: string;
};

export async function updateDocumentInventory(
  user: SessionUser,
  id: string,
  data: {
    title?: string;
    transferCode?: string;
    entitySender?: string;
    entityProducer?: string;
    adminUnit?: string;
    producerOffice?: string;
    objectDescription?: string;
    items?: InventoryItemUpdate[];
  }
) {
  const inv = await prisma.documentInventory.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!inv) throw new AppError("Inventario no encontrado", 404);
  if (inv.status === "VALIDATED" || inv.status === "SENT") {
    throw new AppError("No puede editar un inventario validado o enviado", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentInventory.update({
      where: { id },
      data: {
        title: data.title,
        transferCode: data.transferCode,
        entitySender: data.entitySender,
        entityProducer: data.entityProducer,
        adminUnit: data.adminUnit,
        producerOffice: data.producerOffice,
        objectDescription: data.objectDescription,
      },
    });

    for (const item of data.items ?? []) {
      await tx.documentInventoryItem.update({
        where: { id: item.id },
        data: {
          orderNumber: item.orderNumber,
          seriesName: item.seriesName,
          subseriesName: item.subseriesName,
          subject: item.subject,
          expedienteCode: item.expedienteCode,
          unitName: item.unitName,
          dateStart: item.dateStart ? new Date(item.dateStart) : item.dateStart === null ? null : undefined,
          dateEnd: item.dateEnd ? new Date(item.dateEnd) : item.dateEnd === null ? null : undefined,
          supportPhysical: item.supportPhysical,
          supportElectronic: item.supportElectronic,
          boxCode: item.boxCode,
          folderNumber: item.folderNumber,
          folioCount: item.folioCount,
          format: item.format,
          quantity: item.quantity,
          location: item.location,
          notes: item.notes,
        },
      });
    }
  });

  return getDocumentInventory(user, id);
}

/** Campos obligatorios AGN Anexo 3 antes de marcar VALIDATED. */
export function validateFuidInventoryFields(inv: {
  entitySender: string | null;
  entityProducer: string | null;
  adminUnit: string | null;
  producerOffice: string | null;
  objectDescription: string | null;
  items: Array<{
    expedienteCode: string | null;
    unitName: string | null;
    dateStart: Date | null;
    dateEnd: Date | null;
  }>;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!inv.entitySender?.trim()) errors.push("Entidad remitente requerida");
  if (!inv.entityProducer?.trim()) errors.push("Entidad productora requerida");
  if (!inv.adminUnit?.trim()) errors.push("Unidad administrativa requerida");
  if (!inv.producerOffice?.trim()) errors.push("Oficina productora requerida");
  if (!inv.objectDescription?.trim()) errors.push("Objeto del FUID requerido");
  if (!inv.items.length) errors.push("El inventario debe tener al menos un ítem");
  inv.items.forEach((item, idx) => {
    const n = item.expedienteCode ?? `#${idx + 1}`;
    if (!item.expedienteCode?.trim()) errors.push(`Ítem ${n}: código de expediente requerido`);
    if (!item.unitName?.trim()) errors.push(`Ítem ${n}: unidad documental requerida`);
    if (!item.dateStart) errors.push(`Ítem ${n}: fecha inicial requerida`);
    if (!item.dateEnd) errors.push(`Ítem ${n}: fecha final requerida`);
  });
  return { ok: errors.length === 0, errors };
}

export async function validateDocumentInventory(user: SessionUser, id: string) {
  const inv = await prisma.documentInventory.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { items: true },
  });
  if (!inv) throw new AppError("Inventario no encontrado", 404);

  const check = validateFuidInventoryFields(inv);
  if (!check.ok) {
    throw new AppError(`FUID incompleto: ${check.errors.slice(0, 3).join("; ")}${check.errors.length > 3 ? "…" : ""}`, 400);
  }

  const expedienteIds = [
    ...new Set(inv.items.map((i) => i.expedienteId).filter(Boolean) as string[]),
  ];

  const updated = await prisma.documentInventory.update({
    where: { id },
    data: { status: "VALIDATED", validatedAt: new Date() },
  });

  if (expedienteIds.length) {
    const { markExpedienteFuidComplete } = await import(
      "@/modules/expedientes/application/expediente-cycle-service"
    );
    await markExpedienteFuidComplete(user, expedienteIds);
  }

  return updated;
}

export async function updateInventoryStatus(
  user: SessionUser,
  id: string,
  status: InventoryStatus
) {
  const inv = await prisma.documentInventory.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!inv) throw new AppError("Inventario no encontrado", 404);
  return prisma.documentInventory.update({
    where: { id },
    data: { status },
  });
}
