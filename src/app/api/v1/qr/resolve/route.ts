import { NextRequest } from "next/server";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError } from "@/shared/kernel/http";
import { resolveQrScan } from "@/modules/physical-archive/application/qr-resolve-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) throw new AppError("Indique el código escaneado", 400);

    const result = await resolveQrScan(user, q);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
