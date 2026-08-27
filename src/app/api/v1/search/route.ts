import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError } from "@/shared/kernel/http";
import { searchDocuments } from "@/modules/documents";
import { prisma } from "@/shared/kernel/prisma";
import { documentScope } from "@/modules/documents/application/documents-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.read");

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) throw new AppError("Consulta de búsqueda inválida", 400);

    const exactQr = req.nextUrl.searchParams.get("exactQr") === "1";
    if (exactQr) {
      const exact = await prisma.document.findFirst({
        where: {
          ...documentScope(user),
          OR: [
            { qrCode: { equals: q, mode: "insensitive" } },
            { code: { equals: q, mode: "insensitive" } },
            { barcode: { equals: q, mode: "insensitive" } },
          ],
        },
        include: { dependency: true },
      });
      return jsonOk(exact ? [exact] : []);
    }

    const results = await searchDocuments(user, q, 30);
    return jsonOk(results);
  } catch (e) {
    return jsonError(e);
  }
}
