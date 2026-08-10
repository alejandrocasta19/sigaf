import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { isAdminRole, updateUserRole } from "@/modules/identity";
import { prisma } from "@/shared/kernel/prisma";

const patchSchema = z.object({
  roleId: z.string().min(1).optional(),
  dependencyId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "BLOCKED", "INACTIVE"]).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "users.update");
    if (!isAdminRole(user)) throw new AppError("Acceso denegado", 403);

    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    if (body.password) {
      const { assertPasswordPolicy } = await import("@/shared/kernel/password-policy");
      assertPasswordPolicy(body.password);
    }

    const existing = await prisma.user.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
    });
    if (!existing) throw new AppError("Usuario no encontrado", 404);

    if (body.email) {
      const email = body.email.toLowerCase().trim();
      const clash = await prisma.user.findFirst({
        where: {
          email,
          deletedAt: null,
          NOT: { id },
        },
        select: { id: true },
      });
      if (clash) throw new AppError("El correo ya está en uso", 400);
    }

    if (body.roleId) {
      await updateUserRole(user, id, body.roleId, body.dependencyId);
    }

    const data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      status?: "ACTIVE" | "BLOCKED" | "INACTIVE";
      dependencyId?: string | null;
      passwordHash?: string;
    } = {};

    if (body.firstName !== undefined) data.firstName = body.firstName.trim();
    if (body.lastName !== undefined) data.lastName = body.lastName.trim();
    if (body.email !== undefined) data.email = body.email.toLowerCase().trim();
    if (body.status !== undefined) data.status = body.status;
    if (body.dependencyId !== undefined && !body.roleId) {
      data.dependencyId = body.dependencyId;
    }
    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { role: true, dependency: true },
    });

    if (body.password || body.status === "BLOCKED" || body.status === "INACTIVE") {
      await prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await writeAudit({
      user,
      action: "USER_UPDATE",
      module: "identity",
      entityType: "User",
      entityId: id,
      changes: {
        ...body,
        password: body.password ? "[changed]" : undefined,
      },
      req,
    });

    return jsonOk(updated);
  } catch (e) {
    if (e instanceof Error && !(e instanceof AppError) && e.name !== "ZodError") {
      return jsonError(new AppError(e.message, 400));
    }
    return jsonError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "users.delete");
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(user.roleCode)) {
      throw new AppError("Acceso denegado", 403);
    }

    const { id } = await ctx.params;
    if (id === user.id) throw new AppError("No puedes eliminarte a ti mismo", 400);

    const existing = await prisma.user.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new AppError("Usuario no encontrado", 404);

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
    await prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await writeAudit({
      user,
      action: "USER_DELETE",
      module: "identity",
      entityType: "User",
      entityId: id,
      req,
    });

    return jsonOk({ deleted: true });
  } catch (e) {
    return jsonError(e);
  }
}
