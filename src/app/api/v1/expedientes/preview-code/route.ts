import { NextRequest } from "next/server";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError } from "@/shared/kernel/http";
import { generateTrdExpedienteCode } from "@/modules/expedientes";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const sp = req.nextUrl.searchParams;
    const dependencyId = sp.get("dependencyId");
    if (!dependencyId) throw new AppError("dependencyId requerido", 400);

    const year = sp.get("year") ? parseInt(sp.get("year")!, 10) : new Date().getFullYear();
    const seriesId = sp.get("seriesId") || undefined;

    const code = await generateTrdExpedienteCode({
      organizationId: user.organizationId,
      dependencyId,
      seriesId,
      year,
    });

    return jsonOk({ code });
  } catch (e) {
    return jsonError(e);
  }
}
