import { NextRequest } from "next/server";
import { getSession } from "@/shared/kernel/auth";
import { jsonOk, jsonError, AppError } from "@/shared/kernel/http";
import {
  countUnread,
  listNotifications,
  listNotificationsSince,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/modules/notifications";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const since = req.nextUrl.searchParams.get("since");
    if (since) {
      const date = new Date(since);
      if (Number.isNaN(date.getTime())) throw new AppError("Fecha since inválida", 400);
      const items = await listNotificationsSince(user, date);
      const unread = await countUnread(user);
      return jsonOk({ items, unread, serverTime: new Date().toISOString() });
    }

    const [items, unread] = await Promise.all([
      listNotifications(user, 30),
      countUnread(user),
    ]);
    return jsonOk({ items, unread, serverTime: new Date().toISOString() });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const body = await req.json();
    if (body.all === true) {
      await markAllNotificationsRead(user);
      return jsonOk({ marked: "all" });
    }
    if (typeof body.id === "string") {
      await markNotificationRead(user, body.id);
      return jsonOk({ marked: body.id });
    }
    throw new AppError("Indica id o all:true", 400);
  } catch (e) {
    return jsonError(e);
  }
}
