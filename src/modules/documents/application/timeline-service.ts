import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import { documentScope } from "@/modules/documents/application/documents-service";

export type TimelineEvent = {
  id: string;
  at: Date;
  action: string;
  module: string;
  actor: string | null;
  ipAddress: string | null;
  detail: string | null;
  source: "audit" | "workflow" | "version";
};

export async function getDocumentTimeline(user: SessionUser, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, ...documentScope(user) },
    select: { id: true, code: true, name: true },
  });
  if (!doc) return null;

  const [audits, workflow, versions] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        organizationId: user.organizationId,
        entityType: "Document",
        entityId: documentId,
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.documentWorkflowEvent.findMany({
      where: { documentId },
      include: { actor: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.documentVersion.findMany({
      where: { documentId },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const a of audits) {
    events.push({
      id: `audit-${a.id}`,
      at: a.createdAt,
      action: a.action,
      module: a.module,
      actor: a.user ? `${a.user.firstName} ${a.user.lastName}` : null,
      ipAddress: a.ipAddress,
      detail: a.changes ? JSON.stringify(a.changes) : null,
      source: "audit",
    });
  }

  for (const w of workflow) {
    events.push({
      id: `wf-${w.id}`,
      at: w.createdAt,
      action: w.action,
      module: "workflow",
      actor: w.actor ? `${w.actor.firstName} ${w.actor.lastName}` : null,
      ipAddress: null,
      detail: w.observations,
      source: "workflow",
    });
  }

  for (const v of versions) {
    events.push({
      id: `ver-${v.id}`,
      at: v.createdAt,
      action: `VERSION_${v.version}`,
      module: "documents",
      actor: v.createdBy ? `${v.createdBy.firstName} ${v.createdBy.lastName}` : null,
      ipAddress: null,
      detail: v.changeNote,
      source: "version",
    });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  return { document: doc, events };
}
