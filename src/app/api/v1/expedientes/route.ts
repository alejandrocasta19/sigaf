import { NextRequest } from "next/server";
import { z } from "zod";
import { DocumentStatus } from "@prisma/client";
import { getSession, canAccessDependency, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError, encodeCursor, decodeCursor } from "@/shared/kernel/http";
import { createExpediente, listExpedientes } from "@/modules/expedientes";

const createSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1).optional(),
  dependencyId: z.string().min(1),
  seriesId: z.string().optional(),
  subseriesId: z.string().optional(),
  subsection: z.string().optional(),
  expedienteType: z.string().optional(),
  year: z.number().int().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  identificationConfirmed: z.literal(true),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "expedientes.read");

    const sp = req.nextUrl.searchParams;
    const cursor = decodeCursor(sp.get("cursor"));
    const q = sp.get("q");
    const status = sp.get("status") as DocumentStatus | null;
    const dependencyId = sp.get("dependencyId");

    if (dependencyId && !canAccessDependency(user, dependencyId)) {
      throw new AppError("Sin acceso a la dependencia", 403);
    }

    const page = await listExpedientes({
      user,
      cursor,
      q,
      status: status || undefined,
      dependencyId: dependencyId || undefined,
    });

    return jsonOk({
      items: page.items,
      nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
      hasMore: page.hasMore,
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "expedientes.create");

    const body = createSchema.parse(await req.json());
    if (!canAccessDependency(user, body.dependencyId)) {
      throw new AppError("Sin acceso a la dependencia", 403);
    }

    const exp = await createExpediente(user, body);

    await writeAudit({
      user,
      action: "EXPEDIENTE_CREATE",
      module: "expedientes",
      entityType: "Expediente",
      entityId: exp.id,
      changes: { code: exp.code, name: exp.name },
    });

    return jsonOk(exp, 201);
  } catch (e) {
    return jsonError(e);
  }
}
