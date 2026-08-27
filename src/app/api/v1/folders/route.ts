import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { createFolder, listFolders } from "@/modules/physical-archive";

const createSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  boxId: z.string().optional(),
  color: z.string().optional(),
});

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "folders.read");
    return jsonOk(await listFolders(user));
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "folders.create");

    const body = createSchema.parse(await req.json());
    const folder = await createFolder(user, {
      code: body.code?.trim() ? body.code.trim().toUpperCase() : undefined,
      name: body.name,
      boxId: body.boxId,
      color: body.color,
    });

    await writeAudit({
      user,
      action: "FOLDER_CREATE",
      module: "physical-archive",
      entityType: "Folder",
      entityId: folder.id,
    });

    return jsonOk(folder, 201);
  } catch (e) {
    return jsonError(e);
  }
}
