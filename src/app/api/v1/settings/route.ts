import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import { prisma } from "@/shared/kernel/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "settings.read");
    const key = req.nextUrl.searchParams.get("key");
    const settings = await prisma.systemSetting.findMany({
      where: {
        organizationId: user.organizationId,
        ...(key ? { key } : {}),
      },
    });
    return jsonOk(Object.fromEntries(settings.map((s) => [s.key, s.value])));
  } catch (e) {
    return jsonError(e);
  }
}

const schema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export async function PUT(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "settings.update");
    const body = schema.parse(await req.json());

    const existing = await prisma.systemSetting.findFirst({
      where: { organizationId: user.organizationId, key: body.key },
    });

    const saved = existing
      ? await prisma.systemSetting.update({
          where: { id: existing.id },
          data: { value: body.value as object },
        })
      : await prisma.systemSetting.create({
          data: {
            organizationId: user.organizationId,
            key: body.key,
            value: body.value as object,
          },
        });

    await writeAudit({
      user,
      action: "SETTING_UPDATE",
      module: "settings",
      entityId: saved.id,
      changes: { key: body.key },
      req,
    });

    return jsonOk(saved);
  } catch (e) {
    return jsonError(e);
  }
}
