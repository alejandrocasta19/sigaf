import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/kernel/auth";
import { jsonError, jsonOk, AppError, writeAudit } from "@/shared/kernel/http";
import { prisma } from "@/shared/kernel/prisma";
import {
  generateMfaSecret,
  mfaOtpauthUrl,
  verifyMfaToken,
} from "@/shared/kernel/mfa";
import { refreshSessionCookie } from "@/shared/kernel/session-login";
import {
  adminMfaRequiredInProduction,
  isAdminRoleCode,
} from "@/shared/kernel/production-policy";

const confirmSchema = z.object({
  secret: z.string().min(16),
  code: z.string().min(6).max(8),
});

const disableSchema = z.object({
  code: z.string().min(6).max(8),
});

/** GET: estado MFA del usuario actual + secreto provisional para enrolar */
export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaEnabled: true, email: true },
    });

    if (dbUser?.mfaEnabled) {
      return jsonOk({ enabled: true });
    }

    const secret = generateMfaSecret();
    const otpauth = mfaOtpauthUrl({ email: user.email, secret });
    return jsonOk({ enabled: false, setup: { secret, otpauth } });
  } catch (e) {
    return jsonError(e);
  }
}

/** POST: confirmar enrolamiento MFA */
export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    const body = confirmSchema.parse(await req.json());
    if (!verifyMfaToken(body.secret, body.code)) {
      throw new AppError("Código inválido. Escanee el QR e intente de nuevo.", 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaSecret: body.secret },
    });

    await writeAudit({
      user,
      action: "MFA_ENABLE",
      module: "auth",
      entityType: "User",
      entityId: user.id,
    });

    return (await refreshSessionCookie({ id: user.id, sessionId: user.sessionId })) ?? jsonOk({ enabled: true });
  } catch (e) {
    return jsonError(e);
  }
}

/** DELETE: desactivar MFA (requiere código actual del propio usuario) */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    if (adminMfaRequiredInProduction() && isAdminRoleCode(user.roleCode)) {
      throw new AppError("MFA es obligatorio para administradores en producción", 403);
    }

    const body = disableSchema.parse(await req.json());
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (!dbUser?.mfaEnabled || !dbUser.mfaSecret) {
      return jsonOk({ enabled: false });
    }
    if (!verifyMfaToken(dbUser.mfaSecret, body.code)) {
      throw new AppError("Código MFA incorrecto", 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    await writeAudit({
      user,
      action: "MFA_DISABLE",
      module: "auth",
      entityType: "User",
      entityId: user.id,
    });

    return jsonOk({ enabled: false });
  } catch (e) {
    return jsonError(e);
  }
}
