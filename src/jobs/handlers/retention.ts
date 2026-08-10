import { prisma } from "@/shared/kernel/prisma";
import { notifyUser } from "@/shared/kernel/notify";

export async function runRetentionScanJob(organizationId: string) {
  const now = new Date();
  const due = await prisma.document.findMany({
    where: {
      organizationId,
      deletedAt: null,
      retentionDueAt: { lte: now },
    },
    select: {
      id: true,
      code: true,
      name: true,
      appliedFinalDisposition: true,
      retentionDueAt: true,
    },
    take: 200,
  });

  const admins = await prisma.user.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      role: { code: { in: ["DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"] } },
    },
    select: { id: true },
  });

  const elimination = due.filter((d) => d.appliedFinalDisposition === "ELIMINATION");
  const message = `Retención vencida: ${due.length} documentos (${elimination.length} con disposición ELIMINATION)`;

  for (const admin of admins) {
    await notifyUser({
      organizationId,
      userId: admin.id,
      title: "Alerta de retención documental",
      message,
      link: "/trd/disposals",
      type: "WARNING",
    });
  }

  return {
    scannedAt: now.toISOString(),
    dueCount: due.length,
    eliminationCount: elimination.length,
    notified: admins.length,
    sample: due.slice(0, 10).map((d) => d.code),
  };
}
