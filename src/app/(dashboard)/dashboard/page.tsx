import Link from "next/link";
import {
  FileText,
  FolderOpen,
  Package,
  Folder,
  Users,
  History,
  BadgeCheck,
  Crown,
  UserPlus,
  Shield,
  KeyRound,
  Settings,
  Database,
  Boxes,
  ScrollText,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/modules/system-admin";
import { KpiCard } from "@/modules/system-admin/ui/kpi-card";
import { DonutChartCard, LineChartCard } from "@/shared/charts/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Avatar } from "@/shared/ui/avatar";
import { Progress } from "@/shared/ui/progress";
import { formatDate } from "@/shared/kernel/utils";
import { SuperAdminExtras } from "@/modules/system-admin/ui/role-dashboards";
import { RetentionAlertsPanel } from "@/modules/system-admin/ui/retention-alerts-panel";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const data = await getDashboardData(user);

  if (user.roleCode === "SUPER_ADMIN" || user.roleCode === "SYSTEM_ADMIN") {
    return <SuperAdminDashboard userName={user.fullName} data={data} />;
  }
  if (user.roleCode === "DOC_ADMIN") {
    return <DocAdminDashboard userName={user.fullName} data={data} />;
  }
  if (user.roleCode === "DEPT_HEAD") {
    return (
      <DeptHeadDashboard
        userName={user.fullName}
        dependency={user.dependencyName}
        data={data}
      />
    );
  }
  if (user.roleCode === "DEPT_WORKER") {
    return (
      <DeptWorkerDashboard
        userName={user.fullName}
        dependency={user.dependencyName}
        data={data}
      />
    );
  }
  return <ConsultDashboard userName={user.fullName} data={data} />;
}

type DashData = Awaited<ReturnType<typeof getDashboardData>>;

function SuperAdminDashboard({ userName, data }: { userName: string; data: DashData }) {
  const storage = (data.settings.storage as { usedGb?: number; totalGb?: number }) || {
    usedGb: 256.8,
    totalGb: 1024,
  };
  const usedPct = ((storage.usedGb || 256.8) / (storage.totalGb || 1024)) * 100;

  const adminActions = [
    { label: "Usuarios", href: "/users", icon: UserPlus, color: "bg-blue-500" },
    { label: "Roles", href: "/roles", icon: Shield, color: "bg-violet-500" },
    { label: "Permisos", href: "/roles", icon: KeyRound, color: "bg-indigo-500" },
    { label: "Parámetros", href: "/settings", icon: Settings, color: "bg-slate-600" },
    { label: "Backups", href: "/backups", icon: Database, color: "bg-emerald-500" },
    { label: "Auditoría", href: "/audit", icon: History, color: "bg-amber-500" },
    { label: "Módulos", href: "/settings/modules", icon: Boxes, color: "bg-cyan-500" },
    { label: "Licencias", href: "/licenses", icon: ScrollText, color: "bg-rose-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            Panel de Control - Super Administrador
            <BadgeCheck className="h-6 w-6 text-blue-600" />
          </h1>
          <p className="text-sm text-slate-500">Bienvenido, {userName}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Total Documentos" value={data.kpis.totalDocuments} icon={FileText} iconClass="bg-blue-50 text-blue-600" />
        <KpiCard title="Total Expedientes" value={data.kpis.totalExpedientes} icon={FolderOpen} iconClass="bg-emerald-50 text-emerald-600" />
        <KpiCard title="Total Cajas" value={data.kpis.totalBoxes} icon={Package} iconClass="bg-violet-50 text-violet-600" />
        <KpiCard title="Total Carpetas" value={data.kpis.totalFolders} icon={Folder} iconClass="bg-orange-50 text-orange-600" />
        <KpiCard title="Usuarios Activos" value={data.kpis.activeUsers} icon={Users} iconClass="bg-sky-50 text-sky-600" />
        <KpiCard title="Eventos Auditoría" value={data.kpis.auditCount} icon={History} iconClass="bg-rose-50 text-rose-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <DonutChartCard title="Documentos por Dependencia" data={data.charts.byDependency} />
        <LineChartCard title="Documentos por Año" data={data.charts.byYear} />
        <DonutChartCard title="Documentos por Estado" data={data.charts.byStatus} />
        <Card>
          <CardHeader>
            <CardTitle>Información del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Versión" value={(data.settings.version as string) || "v2.5.1"} />
            <Row label="Base de datos" value="PostgreSQL" />
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-500">Almacenamiento</span>
                <span className="font-medium">
                  {storage.usedGb || 256.8} GB / {storage.totalGb || 1024} GB
                </span>
              </div>
              <Progress value={usedPct} />
            </div>
            <Row
              label="Último backup"
              value={data.lastBackup ? formatDate(data.lastBackup.createdAt) : "N/D"}
            />
            {(() => {
              const staleMs = 36 * 60 * 60 * 1000;
              const backupAt = data.lastBackup?.createdAt
                ? new Date(data.lastBackup.createdAt).getTime()
                : 0;
              const stale = !backupAt || Date.now() - backupAt > staleMs;
              if (!stale) return null;
              return (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Backup ausente o con más de 36 h. Revise{" "}
                    <Link href="/backups" className="underline">
                      /backups
                    </Link>{" "}
                    y el job <code>system.backup</code>.
                  </span>
                </div>
              );
            })()}
            <Row label="Uptime" value="24 días, 14 horas" />
          </CardContent>
        </Card>
      </div>

      <RetentionAlertsPanel
        overdueCount={data.kpis.retentionOverdue}
        dueSoonCount={data.kpis.retentionDueSoon}
        withoutSeriesCount={data.kpis.withoutSeries}
        overdue={data.retention.overdue}
        dueSoon={data.retention.dueSoon}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Acciones de Administración Global</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {adminActions.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 p-4 text-center transition hover:border-blue-200 hover:bg-blue-50/50"
                >
                  <span className={`rounded-xl p-3 text-white ${a.color}`}>
                    <a.icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-medium text-slate-700">{a.label}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 rounded-full bg-blue-600 p-3 text-white">
              <Crown className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-blue-900">Acceso Total</h3>
            <p className="mt-1 text-sm text-blue-700">
              Posees el 100% de permisos del sistema SIGAF.
            </p>
            <Badge className="mt-3" variant="default">
              Nivel 100%
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Actividad del Sistema (tiempo real)</CardTitle>
            <Link href="/audit" className="text-xs text-blue-600 hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="pb-2 font-medium">Usuario</th>
                  <th className="pb-2 font-medium">Acción</th>
                  <th className="pb-2 font-medium">Módulo</th>
                  <th className="pb-2 font-medium">IP</th>
                  <th className="pb-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAudit.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={
                            row.user
                              ? `${row.user.firstName} ${row.user.lastName}`
                              : "Sistema"
                          }
                          className="h-7 w-7"
                        />
                        <div>
                          <p className="font-medium text-slate-800">
                            {row.user
                              ? `${row.user.firstName} ${row.user.lastName}`
                              : "Sistema"}
                          </p>
                          <p className="text-[11px] text-slate-400">{row.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-slate-600">{row.action}</td>
                    <td className="py-2.5">
                      <Badge variant="muted">{row.module}</Badge>
                    </td>
                    <td className="py-2.5 text-slate-500">{row.ipAddress || "—"}</td>
                    <td className="py-2.5 text-slate-500">{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas y Notificaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notifications.map((n) => (
              <div key={n.id} className="flex gap-3 rounded-lg border border-slate-100 p-3">
                <NotifIcon type={n.type} />
                <div>
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <SuperAdminExtras />
    </div>
  );
}

function DocAdminDashboard({ userName, data }: { userName: string; data: DashData }) {
  const quick = [
    { label: "Crear Documento", href: "/documents", color: "bg-emerald-500" },
    { label: "Crear Expediente", href: "/expedientes", color: "bg-blue-500" },
    { label: "Transferencias", href: "/transfers", color: "bg-violet-500" },
    { label: "Inventarios", href: "/inventories", color: "bg-orange-500" },
    { label: "Digitalización", href: "/documents", color: "bg-teal-500" },
    { label: "Reportes", href: "/reports", color: "bg-green-600" },
    { label: "Buscar Documento", href: "/search", color: "bg-sky-500" },
    { label: "Escanear QR", href: "/qr", color: "bg-amber-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Dashboard - Gestión Documental</h1>
        <p className="text-sm text-slate-500">
          Bienvenida, {userName}. Resumen de la gestión archivística.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Documentos Registrados" value={data.kpis.totalDocuments} icon={FileText} />
        <KpiCard title="Expedientes Activos" value={data.kpis.totalExpedientes} icon={FolderOpen} iconClass="bg-emerald-50 text-emerald-600" />
        <KpiCard title="Cajas Archivadas" value={data.kpis.totalBoxes} icon={Package} iconClass="bg-violet-50 text-violet-600" />
        <KpiCard title="Carpetas" value={data.kpis.totalFolders} icon={Folder} iconClass="bg-orange-50 text-orange-600" />
        <KpiCard title="Retención vencida" value={data.kpis.retentionOverdue} note="AG por transferir" icon={AlertTriangle} iconClass="bg-red-50 text-red-600" />
        <KpiCard title="Sin serie TRD" value={data.kpis.withoutSeries} note="Clasificar" icon={History} iconClass="bg-amber-50 text-amber-600" />
      </div>

      <RetentionAlertsPanel
        overdueCount={data.kpis.retentionOverdue}
        dueSoonCount={data.kpis.retentionDueSoon}
        withoutSeriesCount={data.kpis.withoutSeries}
        overdue={data.retention.overdue}
        dueSoon={data.retention.dueSoon}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <DonutChartCard title="Documentos por Dependencia" data={data.charts.byDependency} />
        <LineChartCard title="Documentos por Año" data={data.charts.byYear} />
        <DonutChartCard title="Documentos por Estado" data={data.charts.byStatus} />
        <Card>
          <CardHeader>
            <CardTitle>Bandeja de Tareas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              ["Retención AG vencida", data.kpis.retentionOverdue],
              ["Retención por vencer (90 d)", data.kpis.retentionDueSoon],
              ["Expedientes sin serie TRD", data.kpis.withoutSeries],
              ["Transferencias pendientes", data.kpis.pendingTransfers],
              ["Préstamos activos", data.kpis.activeLoans],
            ].map(([label, count]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-sm"
              >
                <span className="text-slate-700">{label}</span>
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white">
                  {count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instrumentos Archivísticos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.instruments.map((i) => (
              <div
                key={i.id}
                className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"
              >
                <p className="text-xs font-semibold text-emerald-700">{i.type}</p>
                <p className="mt-1 font-semibold text-slate-800">{i.name}</p>
                <p className="mt-2 text-xs text-slate-500">Versión {i.version}</p>
                <p className="text-xs text-slate-500">{i.seriesCount} series</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <ExpedientesTable items={data.recentExpedientes} />
        <ActivityFeed notifications={data.notifications} />
        <LoansTable items={data.activeLoanList} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accesos Rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {quick.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                className="flex flex-col items-center gap-2 rounded-xl p-3 text-center hover:bg-slate-50"
              >
                <span className={`rounded-2xl p-4 text-white shadow ${q.color}`}>
                  <FileText className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium text-slate-700">{q.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DeptHeadDashboard({
  userName,
  dependency,
  data,
}: {
  userName: string;
  dependency: string | null;
  data: DashData;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">
            Dashboard - {dependency || "Dependencia"}
          </h1>
          <p className="text-sm text-slate-500">
            Bienvenido, {userName}. Resumen de la gestión documental de tu dependencia.
          </p>
        </div>
        <Link
          href="/approvals"
          className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          Ver aprobaciones
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Documentos" value={data.kpis.totalDocuments} icon={FileText} />
        <KpiCard title="Expedientes" value={data.kpis.totalExpedientes} icon={FolderOpen} iconClass="bg-emerald-50 text-emerald-600" />
        <KpiCard title="Cajas" value={data.kpis.totalBoxes} icon={Package} iconClass="bg-violet-50 text-violet-600" />
        <KpiCard title="Carpetas" value={data.kpis.totalFolders} icon={Folder} iconClass="bg-orange-50 text-orange-600" />
        <KpiCard title="Préstamos Activos" value={data.kpis.activeLoans} note="Revisar vencimientos" icon={History} iconClass="bg-sky-50 text-sky-600" />
        <KpiCard title="Transferencias" value={data.kpis.pendingTransfers} note="En proceso" icon={ArrowUpRight} iconClass="bg-rose-50 text-rose-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <DonutChartCard title="Documentos por Serie" data={data.charts.byDependency} />
        <LineChartCard title="Documentos por Mes / Año" data={data.charts.byYear} />
        <DonutChartCard title="Documentos por Estado" data={data.charts.byStatus} />
        <Card>
          <CardHeader>
            <CardTitle>Mis Tareas Pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              ["Revisar documentos de funcionarios", "/approvals"],
              ["Mi equipo", "/team"],
              ["Autorizar préstamos", "/loans"],
              ["Transferencias", "/transfers"],
            ].map(([l, href]) => (
              <Link
                key={String(l)}
                href={String(href)}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
              >
                <span>{l}</span>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ExpedientesTable items={data.recentExpedientes} />
        <LoansTable items={data.activeLoanList} />
        <ActivityFeed notifications={data.notifications} />
      </div>
    </div>
  );
}

function DeptWorkerDashboard({
  userName,
  dependency,
  data,
}: {
  userName: string;
  dependency: string | null;
  data: DashData;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">
            Dashboard — {dependency || "Dependencia"}
          </h1>
          <p className="text-sm text-slate-500">
            Hola, {userName}. Cargue documentos para revisión del Jefe de Dependencia.
          </p>
        </div>
        <Link
          href="/documents/new"
          className="inline-flex h-10 items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-700"
        >
          + Cargar documento
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Documentos de la dependencia" value={data.kpis.totalDocuments} icon={FileText} />
        <KpiCard
          title="Expedientes"
          value={data.kpis.totalExpedientes}
          icon={FolderOpen}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          title="En flujo"
          value={
            data.charts.byStatus
              .filter((s) =>
                [
                  "Pendiente de Revisión",
                  "En Revisión por el Jefe",
                  "Rechazado por Dependencia",
                  "En Revisión Archivística",
                ].includes(s.name)
              )
              .reduce((a, b) => a + b.value, 0) || data.kpis.totalDocuments
          }
          note="Bandeja de aprobación"
          icon={BadgeCheck}
          iconClass="bg-amber-50 text-amber-600"
        />
        <KpiCard
          title="Notificaciones"
          value={data.notifications.length}
          icon={Info}
          iconClass="bg-sky-50 text-sky-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DonutChartCard title="Documentos por estado" data={data.charts.byStatus} />
        <Card>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {[
              ["Cargar documento", "/documents/new"],
              ["Mis documentos", "/documents"],
              ["Bandeja de flujo", "/approvals"],
              ["Consultas", "/search"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="rounded-lg border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <ActivityFeed notifications={data.notifications} />
    </div>
  );
}

function ConsultDashboard({ userName, data }: { userName: string; data: DashData }) {
  const quick = [
    { label: "Buscar Documentos", href: "/search" },
    { label: "Buscar Expedientes", href: "/expedientes" },
    { label: "Escanear QR", href: "/qr" },
    { label: "Archivo Físico", href: "/physical-archive" },
    { label: "Descargar", href: "/documents" },
    { label: "Historial", href: "/audit" },
    { label: "Reportes", href: "/reports" },
    { label: "Guía", href: "/help/guide" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Dashboard - Consulta</h1>
        <p className="text-sm text-slate-500">
          Bienvenido, {userName}. Consulta documentos y expedientes autorizados.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Documentos Disponibles" value={data.kpis.totalDocuments} icon={FileText} />
        <KpiCard title="Expedientes Disponibles" value={data.kpis.totalExpedientes} icon={FolderOpen} iconClass="bg-emerald-50 text-emerald-600" />
        <KpiCard title="Cajas Registradas" value={data.kpis.totalBoxes} icon={Package} iconClass="bg-violet-50 text-violet-600" />
        <KpiCard title="Carpetas Registradas" value={data.kpis.totalFolders} icon={Folder} iconClass="bg-teal-50 text-teal-600" />
        <KpiCard title="Ubicaciones" value={data.kpis.locationCount} icon={Boxes} iconClass="bg-amber-50 text-amber-600" />
        <KpiCard title="Préstamos Activos" value={data.kpis.activeLoans} icon={History} iconClass="bg-orange-50 text-orange-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <DonutChartCard title="Documentos por Serie Documental" data={data.charts.byDependency} />
        <LineChartCard title="Documentos por Año" data={data.charts.byYear} />
        <DonutChartCard title="Documentos por Estado" data={data.charts.byStatus} />
        <Card>
          <CardHeader>
            <CardTitle>Búsqueda Rápida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Palabra clave..."
            />
            <Link
              href="/search"
              className="flex h-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
            >
              Buscar Documentos
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row justify-between">
            <CardTitle>Documentos Recientes</CardTitle>
            <Link href="/documents" className="text-xs text-blue-600">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentDocuments.map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-800">{d.code}</p>
                <p className="truncate text-xs text-slate-500">{d.name}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <ExpedientesTable items={data.recentExpedientes} />
        <Card>
          <CardHeader>
            <CardTitle>Avisos y Comunicaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notifications.map((n) => (
              <div key={n.id} className="flex gap-3 rounded-lg border p-3">
                <NotifIcon type={n.type} />
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accesos Rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {quick.map((q) => (
              <Link
                key={q.label}
                href={q.href}
                className="rounded-xl border border-slate-200 p-4 text-center text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50"
              >
                {q.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function NotifIcon({ type }: { type: string }) {
  if (type === "WARNING" || type === "ALERT")
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
  if (type === "SUCCESS") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (type === "ERROR") return <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />;
  return <Info className="h-4 w-4 shrink-0 text-blue-500" />;
}

function ExpedientesTable({
  items,
}: {
  items: DashData["recentExpedientes"];
}) {
  return (
    <Card>
      <CardHeader className="flex-row justify-between">
        <CardTitle>Expedientes Recientes</CardTitle>
        <Link href="/expedientes" className="text-xs text-blue-600">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-slate-500">
              <th className="pb-2">Código</th>
              <th className="pb-2">Nombre</th>
              <th className="pb-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-slate-50">
                <td className="py-2 font-medium">{e.code}</td>
                <td className="py-2 text-slate-600">{e.name}</td>
                <td className="py-2">
                  <Badge variant={e.status === "ACTIVE" ? "success" : "warning"}>
                    {e.status === "ACTIVE" ? "Activo" : e.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function LoansTable({ items }: { items: DashData["activeLoanList"] }) {
  return (
    <Card>
      <CardHeader className="flex-row justify-between">
        <CardTitle>Préstamos Activos</CardTitle>
        <Link href="/loans" className="text-xs text-blue-600">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-500">Sin préstamos activos</p>
        )}
        {items.map((l) => (
          <div key={l.id} className="rounded-lg border border-slate-100 p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">{l.code}</p>
              <Badge variant={l.status === "OVERDUE" ? "danger" : "success"}>
                {l.status}
              </Badge>
            </div>
            <p className="truncate text-xs text-slate-500">{l.document.name}</p>
            <p className="text-[11px] text-slate-400">
              {l.requester.firstName} · vence{" "}
              {l.dueDate ? formatDate(l.dueDate) : "—"}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityFeed({
  notifications,
}: {
  notifications: DashData["notifications"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className="flex gap-3 border-l-2 border-blue-200 pl-3">
            <div>
              <p className="text-sm text-slate-800">{n.title}</p>
              <p className="text-xs text-slate-500">{n.message}</p>
              <p className="text-[11px] text-slate-400">{formatDate(n.createdAt)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

