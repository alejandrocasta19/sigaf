import { TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { cn, formatNumber } from "@/shared/kernel/utils";

export function KpiCard({
  title,
  value,
  trend,
  note,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: number | string;
  trend?: string;
  note?: string;
  icon: LucideIcon;
  iconClass?: string;
}) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {typeof value === "number" ? formatNumber(value) : value}
            </p>
            {trend && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                {trend}
              </p>
            )}
            {note && <p className="mt-1 text-[11px] text-slate-500">{note}</p>}
          </div>
          <div className={cn("rounded-xl p-2.5", iconClass ?? "bg-blue-50 text-blue-600")}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
