import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import type { SessionUser } from "./types";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "APP_ERROR"
  ) {
    super(message);
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(error: unknown, fallback = "Error interno") {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name?: string }).name === "ZodError"
  ) {
    const issues = (error as { issues?: { message?: string }[] }).issues;
    const message = issues?.[0]?.message || "Datos inválidos";
    return NextResponse.json(
      { success: false, error: message, code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  console.error(error);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

export async function writeAudit(params: {
  user?: SessionUser | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  changes?: unknown;
  ipAddress?: string | null;
  req?: Request | null;
}) {
  try {
    let organizationId: string | undefined;
    if (params.user?.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: params.user.organizationId },
        select: { id: true },
      });
      organizationId = org?.id;
    }

    let userId: string | undefined;
    if (params.user?.id) {
      const u = await prisma.user.findUnique({
        where: { id: params.user.id },
        select: { id: true },
      });
      userId = u?.id;
    }

    const ip =
      params.ipAddress ??
      (params.req
        ? params.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          params.req.headers.get("x-real-ip")
        : undefined);

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: params.action,
        module: params.module,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes as object | undefined,
        ipAddress: ip ?? undefined,
      },
    });
  } catch (err) {
    console.error("[writeAudit]", err);
  }
}

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function encodeCursor(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function decodeCursor(cursor?: string | null) {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
