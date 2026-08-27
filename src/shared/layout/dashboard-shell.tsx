"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/shared/layout/app-sidebar";
import { AppHeader } from "@/shared/layout/app-header";
import type { SessionUser } from "@/shared/kernel/types";

type NavCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  close: () => void;
};

const MobileNavContext = createContext<NavCtx | null>(null);

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav debe usarse dentro de DashboardShell");
  return ctx;
}

export function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <MobileNavContext.Provider value={{ open, setOpen, toggle, close }}>
      <div className="flex h-dvh overflow-hidden bg-[#F9FAFB]">
        {open && (
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px] lg:hidden"
            onClick={close}
          />
        )}

        <AppSidebar user={user} mobileOpen={open} onClose={close} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader
            user={user}
            showQuickActions={user.roleCode === "SUPER_ADMIN"}
            onMenuClick={toggle}
          />
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 md:p-6">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}
