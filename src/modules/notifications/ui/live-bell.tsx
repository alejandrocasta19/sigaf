"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/shared/kernel/utils";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

const POLL_MS = 15000;

export function LiveNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const sinceRef = useRef<string>(new Date().toISOString());
  const seenToastIds = useRef<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    const res = await fetch("/api/v1/notifications");
    const data = await res.json();
    if (!res.ok || !data.success) return;
    setItems(data.data.items);
    setUnread(data.data.unread);
    if (data.data.serverTime) sinceRef.current = data.data.serverTime;
    data.data.items.forEach((n: Notif) => seenToastIds.current.add(n.id));
  }, []);

  const pollNew = useCallback(async () => {
    const res = await fetch(
      `/api/v1/notifications?since=${encodeURIComponent(sinceRef.current)}`
    );
    const data = await res.json();
    if (!res.ok || !data.success) return;

    const fresh: Notif[] = data.data.items ?? [];
    if (data.data.serverTime) sinceRef.current = data.data.serverTime;
    if (typeof data.data.unread === "number") setUnread(data.data.unread);

    for (const n of fresh) {
      if (seenToastIds.current.has(n.id)) continue;
      seenToastIds.current.add(n.id);
      const fn =
        n.type === "ERROR" || n.type === "ALERT"
          ? toast.error
          : n.type === "WARNING"
            ? toast.warning
            : n.type === "SUCCESS"
              ? toast.success
              : toast.info;
      fn(n.title, { description: n.message, duration: 5000 });
      setItems((prev) => [n, ...prev].slice(0, 30));
    }
  }, []);

  useEffect(() => {
    fetchAll().catch(() => undefined);
    const id = setInterval(() => {
      pollNew().catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchAll, pollNew]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function markAll() {
    await fetch("/api/v1/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  async function markOne(id: string) {
    await fetch("/api/v1/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notificaciones</p>
            <button
              type="button"
              onClick={markAll}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar leídas
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                Sin notificaciones
              </li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => markOne(n.id)}
                  className={`w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${
                    !n.read ? "bg-blue-50/40" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{formatDate(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 px-4 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
