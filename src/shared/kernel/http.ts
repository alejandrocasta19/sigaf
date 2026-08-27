import { NextResponse } from "next/server";
import { headers } from "next/headers";
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

export async function jsonError(error: unknown, fallback = "Error interno") {
  let requestId = crypto.randomUUID();
  try {
    requestId = (await headers()).get("x-request-id") || requestId;
  } catch {
    /* fuera de un request */
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code, requestId },
      { status: error.status, headers: { "x-request-id": requestId } }
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
      { success: false, error: message, code: "VALIDATION_ERROR", requestId },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }
  console.error(error);
  return NextResponse.json(
    { success: false, error: fallback, requestId },
    { status: 500, headers: { "x-request-id": requestId } }
  );
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
    const ip =
      params.ipAddress ??
      (params.req
        ? params.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          params.req.headers.get("x-real-ip")
        : undefined);

    await prisma.auditLog.create({
      data: {
        organizationId: params.user?.organizationId,
        userId: params.user?.id,
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
