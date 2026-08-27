import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { changeOwnPassword } from "@/modules/identity";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Ingrese su contraseña actual"),
    newPassword: z.string().min(1, "Ingrese la nueva contraseña"),
    confirmPassword: z.string().min(1, "Confirme la nueva contraseña"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const body = schema.parse(await req.json());
    await changeOwnPassword(user, {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    await writeAudit({
      user,
      action: "USER_PASSWORD_CHANGE",
      module: "identity",
      entityType: "User",
      entityId: user.id,
      req,
    });

    return jsonOk({ message: "Contraseña actualizada" });
  } catch (e) {
    return jsonError(e);
  }
}
