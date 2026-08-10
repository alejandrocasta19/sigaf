"use client";

import {
  Search,
  Settings,
  HelpCircle,
  Menu,
  Mail,
  Calendar,
  QrCode,
  LogOut,
  ChevronDown,
  Zap,
} from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Avatar } from "@/shared/ui/avatar";
import type { SessionUser } from "@/shared/kernel/types";
import { ROLE_THEME } from "@/shared/kernel/types";
import { useState } from "react";
import { LiveNotificationsBell } from "@/modules/notifications/ui/live-bell";

export function AppHeader({
  user,
  searchPlaceholder = "Buscar documentos, expedientes, cajas, carpetas...",
  showQuickActions = false,
}: {
  user: SessionUser;
  searchPlaceholder?: string;
  showQuickActions?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const theme = ROLE_THEME[user.roleCode];

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // igual forzamos salida
    }
    setOpen(false);
    window.location.href = "/login";
  }

  const now = new Date().toLocaleString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-5 backdrop-blur">
      <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      {user.roleCode === "DEPT_HEAD" && user.dependencyName && (
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 md:flex">
          Dependencia actual: <strong className="text-slate-900">{user.dependencyName}</strong>
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      )}

      {user.roleCode === "DEPT_WORKER" && user.dependencyName && (
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 md:flex">
          Dependencia: <strong className="text-slate-900">{user.dependencyName}</strong>
        </div>
      )}

      <div className="relative mx-auto hidden max-w-xl flex-1 md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-10 border-slate-200 bg-slate-50 pl-10"
          placeholder={
            user.roleCode === "SUPER_ADMIN" ? "Buscar en todo el sistema..." : searchPlaceholder
          }
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {user.roleCode === "CONSULT_USER" && (
          <span className="mr-2 hidden text-xs capitalize text-slate-500 xl:inline">{now}</span>
        )}

        {showQuickActions && (
          <Button size="sm" className={`${theme.accent} ${theme.accentHover} mr-1`}>
            <Zap className="h-4 w-4" /> Acciones Rápidas
          </Button>
        )}

        {user.roleCode === "CONSULT_USER" && (
          <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <QrCode className="h-5 w-5" />
          </button>
        )}

        <LiveNotificationsBell />

        {(user.roleCode === "DOC_ADMIN" || user.roleCode === "DEPT_HEAD") && (
          <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <Mail className="h-5 w-5" />
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
              {user.roleCode === "DOC_ADMIN" ? "8" : "2"}
            </span>
          </button>
        )}

        {user.roleCode === "DOC_ADMIN" && (
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <Calendar className="h-5 w-5" />
          </button>
        )}

        {user.roleCode === "SUPER_ADMIN" && (
          <>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Settings className="h-5 w-5" />
            </button>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <HelpCircle className="h-5 w-5" />
            </button>
          </>
        )}

        <div className="relative ml-1">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
          >
            <Avatar name={user.fullName} src={user.avatarUrl} className="h-8 w-8" />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-slate-800">{user.fullName}</p>
              <p className="text-[11px] text-slate-500">
                {user.roleCode === "SUPER_ADMIN" ? "Acceso Total" : user.roleName}
              </p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>
          {open && (
            <div className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
