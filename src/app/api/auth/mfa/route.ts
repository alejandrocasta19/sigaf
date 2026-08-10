import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { z } from "zod";
import { prisma } from "@/shared/kernel/prisma";
import { jsonError, AppError } from "@/shared/kernel/http";
import { verifyMfaToken } from "@/shared/kernel/mfa";
import { createSessionResponse, MFA_COOKIE } from "@/shared/kernel/session-login";

const schema = z.object({
  code: z.string().min(6).max(8),
});

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) throw new Error("JWT_SECRET must be configured");
  return new TextEncoder().encode(secret);
}

export async function POST(req: NextRequest) {
  try {
    const challenge = req.cookies.get(MFA_COOKIE)?.value;
    if (!challenge) throw new AppError("Desafío MFA expirado. Inicie sesión de nuevo.", 401);

    const { payload } = await jwtVerify(challenge, jwtSecret());
    if ((payload as { purpose?: string }).purpose !== "mfa") {
      throw new AppError("Desafío MFA inválido", 401);
    }
    const userId = (payload as { userId?: string }).userId;
    if (!userId) throw new AppError("Desafío MFA inválido", 401);

    const body = schema.parse(await req.json());
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      throw new AppError("MFA no configurado", 400);
    }
    if (!verifyMfaToken(user.mfaSecret, body.code)) {
      throw new AppError("Código MFA incorrecto", 401);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const ua = req.headers.get("user-agent") || undefined;
    return createSessionResponse(user.id, ip, ua);
  } catch (e) {
    return jsonError(e, "Error MFA");
  }
}
