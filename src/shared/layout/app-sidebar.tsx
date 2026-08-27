"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, ChevronRight, HelpCircle, X } from "lucide-react";
import { cn } from "@/shared/kernel/utils";
import { ROLE_THEME, type SessionUser } from "@/shared/kernel/types";
import { getNavForRole } from "@/shared/kernel/navigation";
import { Avatar } from "@/shared/ui/avatar";

export function AppSidebar({
  user,
  mobileOpen = false,
  onClose,
}: {
  user: SessionUser;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const theme = ROLE_THEME[user.roleCode];
  const groups = getNavForRole(user.roleCode);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,88vw)] shrink-0 flex-col overflow-hidden text-white transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-full lg:w-72 lg:translate-x-0",
        theme.sidebar,
        mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500">
          <FolderOpen className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold tracking-tight">SIGAF</p>
          <p className="truncate text-[10px] leading-tight text-white/60">
            Sistema Integral de Gestión de Archivos Físicos
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar menú"
          className="rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {user.roleCode !== "SUPER_ADMIN" && (
        <div className="mx-3 mt-3 flex shrink-0 items-center gap-3 rounded-xl bg-white/10 p-3 sm:mx-4 sm:mt-4">
          <Avatar name={user.fullName} src={user.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.roleName}</p>
            <p className="flex items-center gap-1.5 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              En línea
            </p>
          </div>
        </div>
      )}

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-2 py-3 sm:space-y-5 sm:px-3 sm:py-4">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? theme.activeBg + " text-white shadow-sm"
                          : "text-white/75 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                      {!item.badge && (
                        <ChevronRight className="hidden h-3.5 w-3.5 opacity-0 transition group-hover:opacity-50 sm:block" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {user.roleCode === "SUPER_ADMIN" ? (
        <div className="shrink-0 border-t border-white/10 p-3 sm:p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <Avatar name={user.fullName} src={user.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Super Administrador</p>
              <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Online
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-white/10 p-3 sm:p-4">
          <div className="rounded-xl bg-white/10 p-3 text-center sm:p-4">
            <HelpCircle className="mx-auto mb-2 h-5 w-5 text-white/70" />
            <p className="mb-2 text-sm font-medium">¿Necesitas ayuda?</p>
            <Link
              href="/help/guide"
              onClick={onClose}
              className="inline-flex h-8 w-full items-center justify-center rounded-md bg-blue-500 px-3 text-xs font-medium text-white hover:bg-blue-600"
            >
              Centro de Ayuda
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
