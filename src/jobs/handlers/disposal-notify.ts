import { prisma } from "@/shared/kernel/prisma";
import { notifyUser } from "@/shared/kernel/notify";

export async function runDisposalNotifyJob(organizationId: string) {
  const now = new Date();
  const candidates = await prisma.document.findMany({
    where: {
      organizationId,
      deletedAt: null,
      retentionDueAt: { lte: now },
      appliedFinalDisposition: "ELIMINATION",
    },
    select: { id: true, code: true },
    take: 500,
  });

  const admins = await prisma.user.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      role: { code: { in: ["DOC_ADMIN", "SUPER_ADMIN"] } },
    },
    select: { id: true },
  });

  for (const admin of admins) {
    await notifyUser({
      organizationId,
      userId: admin.id,
      title: "Candidatos a eliminación",
      message: `${candidates.length} documentos listos para proceso de eliminación TRD`,
      link: "/trd/disposals",
      type: "ALERT",
    });
  }

  return { candidates: candidates.length, notified: admins.length };
}
