import { formatDate } from "@/shared/kernel/utils";
import type { TimelineEvent } from "@/modules/documents";

export function DocumentTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">Sin eventos de auditoría registrados.</p>;
  }
  return (
    <ol className="space-y-3 border-l border-slate-200 pl-4">
      {events.map((ev) => (
        <li key={ev.id} className="relative text-sm">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-500" />
          <p className="font-medium text-slate-800">
            {ev.action}{" "}
            <span className="text-xs font-normal text-slate-400">[{ev.source}]</span>
          </p>
          <p className="text-xs text-slate-500">
            {ev.actor ?? "Sistema"} · {formatDate(ev.at)}
            {ev.ipAddress ? ` · IP ${ev.ipAddress}` : ""}
          </p>
          {ev.detail && <p className="mt-1 text-slate-600 break-all">{ev.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
