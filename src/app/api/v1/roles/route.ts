import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError } from "@/shared/kernel/http";
import { isAdminRole, listRoles, listPermissions } from "@/modules/identity";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "roles.read");
    if (!isAdminRole(user)) throw new AppError("Acceso denegado", 403);

    const [roles, permissions] = await Promise.all([listRoles(), listPermissions()]);
    return jsonOk({ roles, permissions });
  } catch (e) {
    return jsonError(e);
  }
}
