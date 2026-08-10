import type { NotificationType } from "@prisma/client";
import { prisma } from "@/shared/kernel/prisma";
import { sendMail } from "@/shared/kernel/mail";

export async function createNotification(params: {
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  link?: string;
  type?: NotificationType;
}) {
  return prisma.notification.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      title: params.title,
      message: params.message,
      link: params.link,
      type: params.type ?? "INFO",
    },
  });
}

export async function notifyUser(params: {
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  link?: string;
  type?: NotificationType;
}) {
  await createNotification(params);

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true },
  });
  if (user?.email) {
    await sendMail({
      to: user.email,
      subject: `[SIGAF] ${params.title}`,
      text: `${params.message}${params.link ? `\n\nVer: ${process.env.APP_URL || "http://localhost:3000"}${params.link}` : ""}`,
    }).catch(() => undefined);
  }
}
