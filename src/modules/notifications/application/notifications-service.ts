import { prisma } from "@/shared/kernel/prisma";
import type { SessionUser } from "@/shared/kernel/types";
import type { NotificationType } from "@prisma/client";

export async function listNotifications(user: SessionUser, take = 50) {
  return prisma.notification.findMany({
    where: {
      OR: [{ userId: user.id }, { organizationId: user.organizationId, userId: null }],
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listUnreadNotifications(user: SessionUser, take = 20) {
  return prisma.notification.findMany({
    where: {
      read: false,
      OR: [{ userId: user.id }, { organizationId: user.organizationId, userId: null }],
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function countUnread(user: SessionUser) {
  return prisma.notification.count({
    where: {
      read: false,
      OR: [{ userId: user.id }, { organizationId: user.organizationId, userId: null }],
    },
  });
}

export async function listNotificationsSince(user: SessionUser, since: Date) {
  return prisma.notification.findMany({
    where: {
      createdAt: { gt: since },
      OR: [{ userId: user.id }, { organizationId: user.organizationId, userId: null }],
    },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
}

export async function markNotificationRead(user: SessionUser, id: string) {
  return prisma.notification.updateMany({
    where: {
      id,
      OR: [{ userId: user.id }, { organizationId: user.organizationId, userId: null }],
    },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(user: SessionUser) {
  return prisma.notification.updateMany({
    where: {
      read: false,
      OR: [{ userId: user.id }, { organizationId: user.organizationId, userId: null }],
    },
    data: { read: true },
  });
}

export async function createNotification(data: {
  organizationId?: string;
  userId?: string;
  type?: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  return prisma.notification.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      type: data.type ?? "INFO",
      title: data.title,
      message: data.message,
      link: data.link,
    },
  });
}
