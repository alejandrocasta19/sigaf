import { NextRequest } from "next/server";
import { z } from "zod";
import { DocumentStatus } from "@prisma/client";
import { getSession, canAccessDependency, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError, encodeCursor, decodeCursor } from "@/shared/kernel/http";
import { createDocument, listDocuments } from "@/modules/documents";

const createSchema = z.object({
  name: z.string().min(1),
  dependencyId: z.string().min(1),
  code: z.string().optional(),
  folioCount: z.number().int().min(1).default(1),
  observations: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.read");

    const sp = req.nextUrl.searchParams;
    const cursor = decodeCursor(sp.get("cursor"));
    const q = sp.get("q");
    const status = sp.get("status") as DocumentStatus | null;
    const dependencyId = sp.get("dependencyId");

    if (dependencyId && !canAccessDependency(user, dependencyId)) {
      throw new AppError("Sin acceso a la dependencia", 403);
    }

    const page = await listDocuments({
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
    requirePermission(user, "documents.create");

    const body = createSchema.parse(await req.json());
    if (!canAccessDependency(user, body.dependencyId)) {
      throw new AppError("Sin acceso a la dependencia", 403);
    }

    const doc = await createDocument(user, body);

    await writeAudit({
      user,
      action: "DOCUMENT_CREATE",
      module: "documents",
      entityType: "Document",
      entityId: doc.id,
      changes: { code: doc.code, name: doc.name },
    });

    return jsonOk(doc, 201);
  } catch (e) {
    return jsonError(e);
  }
}
