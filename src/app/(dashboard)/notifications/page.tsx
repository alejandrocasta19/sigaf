import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { listNotifications } from "@/modules/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";

export default async function NotificationsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const notifications = await listNotifications(user, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Notificaciones</h1>
        <p className="text-sm text-slate-500">
          Avisos en tiempo real · se actualizan automáticamente en la campana del header
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis notificaciones ({notifications.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 ${n.read ? "border-slate-100 bg-white" : "border-blue-100 bg-blue-50/30"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{n.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatDate(n.createdAt)}</p>
                </div>
                <Badge variant={n.read ? "muted" : "info"}>{n.type}</Badge>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">Sin notificaciones</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
