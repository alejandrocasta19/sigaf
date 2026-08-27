import { getSession } from "@/shared/kernel/auth";
import { requirePageAccess } from "@/shared/kernel/page-access";
import { ReportsPanel } from "@/modules/search-reports/ui/reports-panel";

export default async function ReportsPage() {
  const user = requirePageAccess(await getSession(), { permission: "reports.read" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Reportes</h1>
        <p className="text-sm text-slate-500">
          Exporta PDF, Excel o CSV e importa documentos masivamente
        </p>
      </div>
      <ReportsPanel canImport={user.roleCode !== "CONSULT_USER"} />
    </div>
  );
}
