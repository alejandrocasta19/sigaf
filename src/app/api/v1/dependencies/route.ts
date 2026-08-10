import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { createDependency, listDependencies } from "@/modules/identity";

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "dependencies.read");

    const deps = await listDependencies(user);
    return jsonOk(deps);
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "dependencies.create");

    const body = createSchema.parse(await req.json());
    const dep = await createDependency(user, body);

    await writeAudit({
      user,
      action: "DEPENDENCY_CREATE",
      module: "identity",
      entityType: "Dependency",
      entityId: dep.id,
    });

    return jsonOk(dep, 201);
  } catch (e) {
    return jsonError(e);
  }
}
