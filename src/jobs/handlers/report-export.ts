import { prisma } from "@/shared/kernel/prisma";
import { putObject, buildStorageKey } from "@/shared/kernel/storage";
import {
  fetchReportRows,
  buildCsv,
  buildExcelBuffer,
  buildPdfBuffer,
  type ReportFormat,
  type ReportType,
} from "@/modules/search-reports";
import type { SessionUser } from "@/shared/kernel/types";
import { RoleCode } from "@prisma/client";

type Payload = { type?: string; format?: string; userId?: string };

async function loadUser(organizationId: string, userId?: string): Promise<SessionUser> {
  if (!userId) throw new Error("userId requerido");
  const u = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      dependency: true,
      organization: true,
    },
  });
  if (!u) throw new Error("Usuario no encontrado");
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`,
    roleCode: u.role.code as RoleCode,
    roleName: u.role.name,
    accessLevel: u.role.accessLevel,
    organizationId: u.organizationId,
    organizationName: u.organization.name,
    dependencyId: u.dependencyId,
    dependencyName: u.dependency?.name ?? null,
    permissions: u.role.permissions.map((rp) => rp.permission.code),
    avatarUrl: u.avatarUrl,
  };
}

export async function runReportExportJob(
  payload: unknown,
  ctx: { organizationId: string; userId?: string }
) {
  const p = (payload ?? {}) as Payload;
  const type = p.type as ReportType;
  const format = (p.format || "xlsx") as ReportFormat;
  const user = await loadUser(ctx.organizationId, p.userId ?? ctx.userId);
  const data = await fetchReportRows(user, type);

  let buffer: Buffer;
  let contentType: string;
  let ext: string;
  if (format === "xlsx") {
    buffer = await buildExcelBuffer(data.title, data.headers, data.rows);
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  } else if (format === "pdf") {
    buffer = buildPdfBuffer(data.title, data.headers, data.rows);
    contentType = "application/pdf";
    ext = "pdf";
  } else {
    buffer = buildCsv(data.headers, data.rows);
    contentType = "text/csv; charset=utf-8";
    ext = "csv";
  }

  const storageKey = buildStorageKey({
    orgId: ctx.organizationId,
    category: "reports",
    originalName: `sigaf-${type}.${ext}`,
  });
  await putObject({ storageKey, buffer, contentType });

  return {
    storageKey,
    filename: `sigaf-${type}-${new Date().toISOString().slice(0, 10)}.${ext}`,
    contentType,
    rows: data.rows.length,
  };
}
