import Link from "next/link";
import { AlertTriangle, Clock3, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";

type RetentionItem = {
  id: string;
  code: string;
  name: string;
  subject: string | null;
  retentionDueAt: Date | string | null;
  appliedRetentionMgmt: number | null;
  appliedRetentionCentral: number | null;
  dependency: { name: string };
};

export function RetentionAlertsPanel({
  overdueCount,
  dueSoonCount,
  withoutSeriesCount,
  overdue,
  dueSoon,
}: {
  overdueCount: number;
  dueSoonCount: number;
  withoutSeriesCount: number;
  overdue: RetentionItem[];
  dueSoon: RetentionItem[];
}) {
  const hasAny = overdueCount + dueSoonCount + withoutSeriesCount > 0;

  return (
    <Card className={hasAny ? "border-amber-200" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Retención AG/AC
        </CardTitle>
        <p className="text-xs text-slate-500">
          Vencidos, por vencer (90 días) y expedientes sin serie TRD
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/expedientes?filter=retention-overdue"
            className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-center hover:bg-red-50"
          >
            <p className="text-lg font-bold text-red-700">{overdueCount}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-red-600">
              Vencidos AG
            </p>
          </Link>
          <Link
            href="/expedientes?filter=retention-soon"
            className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-center hover:bg-amber-50"
          >
            <p className="text-lg font-bold text-amber-700">{dueSoonCount}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">
              Por vencer
            </p>
          </Link>
          <Link
            href="/expedientes?filter=no-series"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center hover:bg-slate-100"
          >
            <p className="text-lg font-bold text-slate-800">{withoutSeriesCount}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
              Sin serie TRD
            </p>
          </Link>
        </div>

        {!hasAny && (
          <p className="text-sm text-slate-500">Sin alertas de retención por ahora.</p>
        )}

        {overdue.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-red-700">
              <Clock3 className="h-3.5 w-3.5" /> Vencidos
            </p>
            <ul className="space-y-1.5">
              {overdue.map((e) => (
                <RetentionRow key={e.id} item={e} tone="danger" />
              ))}
            </ul>
          </div>
        )}

        {dueSoon.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700">
              <Layers className="h-3.5 w-3.5" /> Por vencer
            </p>
            <ul className="space-y-1.5">
              {dueSoon.map((e) => (
                <RetentionRow key={e.id} item={e} tone="warning" />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RetentionRow({
  item,
  tone,
}: {
  item: RetentionItem;
  tone: "danger" | "warning";
}) {
  const ag = item.appliedRetentionMgmt ?? "—";
  const ac = item.appliedRetentionCentral ?? "—";
  return (
    <li>
      <Link
        href={`/expedientes/${item.id}`}
        className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2 hover:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {item.code} · {item.subject ?? item.name}
          </p>
          <p className="text-[11px] text-slate-500">
            {item.dependency.name} · AG {ag} / AC {ac} años
          </p>
        </div>
        <Badge variant={tone === "danger" ? "danger" : "warning"}>
          {item.retentionDueAt ? formatDate(item.retentionDueAt) : "—"}
        </Badge>
      </Link>
    </li>
  );
}
