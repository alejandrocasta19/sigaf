import { NextRequest } from "next/server";
import { getSession } from "@/shared/kernel/auth";
import { jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import { generateStoredBoxLabelPdf } from "@/modules/physical-archive";
import { prisma } from "@/shared/kernel/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    const { id } = await ctx.params;

    const box = await prisma.box.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!box) throw new AppError("Caja no encontrada", 404);

    const pdf = await generateStoredBoxLabelPdf(user, id);

    await writeAudit({
      user,
      action: "BOX_LABEL_PRINT",
      module: "physical-archive",
      entityType: "Box",
      entityId: box.id,
      changes: { code: box.code },
      req,
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="etiqueta-caja-${box.code}.pdf"`,
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
