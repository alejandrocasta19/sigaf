import { NextRequest } from "next/server";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError, encodeCursor, decodeCursor } from "@/shared/kernel/http";
import { isAdminRole } from "@/modules/identity";
import { prisma } from "@/shared/kernel/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    if (!isAdminRole(user)) throw new AppError("Acceso denegado", 403);

    const cursor = decodeCursor(req.nextUrl.searchParams.get("cursor"));
    const take = 30;

    const items = await prisma.auditLog.findMany({
      where: { organizationId: user.organizationId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;

    return jsonOk({
      items: page,
      nextCursor: hasMore ? encodeCursor(page[page.length - 1]!.id) : null,
      hasMore,
    });
  } catch (e) {
    return jsonError(e);
  }
}
