import type { SessionUser } from "@/shared/kernel/types";
import { prisma } from "@/shared/kernel/prisma";
import { AppError } from "@/shared/kernel/http";
import { parseQrPayload } from "@/shared/kernel/qr-codes";
import { documentScope } from "@/modules/documents/application/documents-service";

export type QrResolveResult =
  | {
      type: "document";
      id: string;
      code: string;
      name: string;
      qrCode: string | null;
      status: string;
      dependency?: { name: string } | null;
      href: string;
    }
  | {
      type: "box";
      id: string;
      code: string;
      qrCode: string;
      status: string;
      location: string;
      folderCount: number;
      folders: string[];
      href: string;
    }
  | {
      type: "expediente";
      id: string;
      code: string;
      name: string;
      boxCode: string | null;
      href: string;
    };

export async function resolveQrScan(user: SessionUser, raw: string): Promise<QrResolveResult> {
  const parsed = parseQrPayload(raw);
  if (!parsed.raw || parsed.raw.length < 2) {
    throw new AppError("Código QR vacío o inválido", 400);
  }

  if (parsed.kind === "box" || looksLikeBox(parsed)) {
    const box = await findBox(user, parsed.code, parsed.qrCode, parsed.raw);
    if (box) {
      const locParts = [
        box.location?.parent?.parent?.name,
        box.location?.parent?.name,
        box.location?.name,
      ].filter(Boolean);
      return {
        type: "box",
        id: box.id,
        code: box.code,
        qrCode: box.qrCode,
        status: box.status,
        location: locParts.join(" / ") || "Sin ubicación",
        folderCount: box.folders.length,
        folders: box.folders.map((f) => f.code),
        href: `/physical-archive/boxes/${box.id}`,
      };
    }
    if (parsed.kind === "box") {
      throw new AppError("No se encontró ninguna caja con ese código QR", 404);
    }
  }

  if (parsed.kind === "expediente") {
    const exp = await prisma.expediente.findFirst({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        code: { equals: parsed.code ?? parsed.raw, mode: "insensitive" },
      },
      select: { id: true, code: true, name: true, boxCode: true },
    });
    if (exp) {
      return {
        type: "expediente",
        id: exp.id,
        code: exp.code,
        name: exp.name,
        boxCode: exp.boxCode,
        href: `/expedientes/${exp.id}`,
      };
    }
    throw new AppError("No se encontró ningún expediente con ese código", 404);
  }

  const doc = await findDocument(user, parsed.code, parsed.qrCode, parsed.raw);
  if (doc) {
    return {
      type: "document",
      id: doc.id,
      code: doc.code,
      name: doc.name,
      qrCode: doc.qrCode,
      status: doc.status,
      dependency: doc.dependency,
      href: `/documents/${doc.id}`,
    };
  }

  // Último intento: caja por código suelto
  const boxFallback = await findBox(user, parsed.code, parsed.qrCode, parsed.raw);
  if (boxFallback) {
    const locParts = [
      boxFallback.location?.parent?.parent?.name,
      boxFallback.location?.parent?.name,
      boxFallback.location?.name,
    ].filter(Boolean);
    return {
      type: "box",
      id: boxFallback.id,
      code: boxFallback.code,
      qrCode: boxFallback.qrCode,
      status: boxFallback.status,
      location: locParts.join(" / ") || "Sin ubicación",
      folderCount: boxFallback.folders.length,
      folders: boxFallback.folders.map((f) => f.code),
      href: `/physical-archive/boxes/${boxFallback.id}`,
    };
  }

  throw new AppError("No se encontró documento ni caja con ese código QR", 404);
}

function looksLikeBox(parsed: ReturnType<typeof parseQrPayload>) {
  const c = (parsed.code ?? parsed.qrCode ?? parsed.raw).toUpperCase();
  return c.startsWith("CAJ") || c.startsWith("SIGAF-BOX") || c.includes('"T":"BOX"');
}

async function findBox(
  user: SessionUser,
  code: string | null,
  qrCode: string | null,
  raw: string
) {
  const or = [
    ...(code ? [{ code: { equals: code, mode: "insensitive" as const } }] : []),
    ...(qrCode ? [{ qrCode: { equals: qrCode, mode: "insensitive" as const } }] : []),
    { qrCode: { equals: raw, mode: "insensitive" as const } },
    { code: { equals: raw, mode: "insensitive" as const } },
  ];

  return prisma.box.findFirst({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      OR: or,
    },
    include: {
      location: { include: { parent: { include: { parent: true } } } },
      folders: {
        where: { deletedAt: null },
        select: { code: true },
        orderBy: { code: "asc" },
        take: 20,
      },
    },
  });
}

async function findDocument(
  user: SessionUser,
  code: string | null,
  qrCode: string | null,
  raw: string
) {
  return prisma.document.findFirst({
    where: {
      ...documentScope(user),
      OR: [
        ...(code
          ? [
              { code: { equals: code, mode: "insensitive" as const } },
              { qrCode: { equals: code, mode: "insensitive" as const } },
            ]
          : []),
        ...(qrCode ? [{ qrCode: { equals: qrCode, mode: "insensitive" as const } }] : []),
        { qrCode: { equals: raw, mode: "insensitive" as const } },
        { code: { equals: raw, mode: "insensitive" as const } },
        { barcode: { equals: raw, mode: "insensitive" as const } },
      ],
    },
    include: { dependency: true },
  });
}
