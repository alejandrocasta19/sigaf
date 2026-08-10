import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/shared/layout/app-sidebar";
import { AppHeader } from "@/shared/layout/app-header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <AppSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={user}
          showQuickActions={user.roleCode === "SUPER_ADMIN"}
        />
        <main className="flex-1 overflow-y-auto p-5 md:p-6">{children}</main>
      </div>
    </div>
  );
}
