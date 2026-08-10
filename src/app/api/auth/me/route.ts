import { getSession } from "@/shared/kernel/auth";
import { jsonError, jsonOk, AppError } from "@/shared/kernel/http";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    return jsonOk({ user });
  } catch (e) {
    return jsonError(e);
  }
}
