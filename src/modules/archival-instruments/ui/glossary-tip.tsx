"use client";

import { TRD_GLOSSARY } from "@/shared/kernel/trd-glossary";

export function GlossaryTip({ term }: { term: string }) {
  const entry = TRD_GLOSSARY.find((g) =>
    g.term.toLowerCase().includes(term.toLowerCase())
  );
  if (!entry) return null;
  return (
    <span className="group relative ml-1 inline-flex cursor-help align-middle">
      <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-600">
        ?
      </span>
      <span className="pointer-events-none absolute left-0 top-5 z-20 hidden w-64 rounded-lg border border-slate-200 bg-white p-2 text-left text-xs font-normal text-slate-600 shadow-lg group-hover:block">
        <strong className="block text-slate-800">{entry.term}</strong>
        {entry.definition}
      </span>
    </span>
  );
}
