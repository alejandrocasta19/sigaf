import { NextRequest } from "next/server";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError } from "@/shared/kernel/http";
import { getTrdIdentificationStatus } from "@/modules/archival-instruments";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const sp = req.nextUrl.searchParams;
    const status = await getTrdIdentificationStatus(user, {
      dependencyId: sp.get("dependencyId"),
      seriesId: sp.get("seriesId"),
      subseriesId: sp.get("subseriesId"),
      subject: sp.get("subject"),
    });

    return jsonOk(status);
  } catch (e) {
    return jsonError(e);
  }
}
