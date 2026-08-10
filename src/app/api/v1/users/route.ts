import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { createUser, isAdminRole, listUsers } from "@/modules/identity";

import { assertPasswordPolicy } from "@/shared/kernel/password-policy";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  roleId: z.string().min(1),
  dependencyId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "users.read");
    if (!isAdminRole(user)) throw new AppError("Acceso denegado", 403);

    const users = await listUsers(user);
    return jsonOk(users);
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "users.create");
    if (!isAdminRole(user)) throw new AppError("Acceso denegado", 403);

    const body = createSchema.parse(await req.json());
    assertPasswordPolicy(body.password);
    const created = await createUser(user, body);

    await writeAudit({
      user,
      action: "USER_CREATE",
      module: "identity",
      entityType: "User",
      entityId: created.id,
      changes: { email: created.email, roleId: created.roleId },
    });

    return jsonOk(created, 201);
  } catch (e) {
    return jsonError(e);
  }
}
