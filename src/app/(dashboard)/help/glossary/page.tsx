import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TRD_GLOSSARY } from "@/shared/kernel/trd-glossary";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export default async function GlossaryPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Glosario archivístico</h1>
        <p className="text-sm text-slate-500">
          Conceptos TRD ·{" "}
          <Link href="/trd" className="text-emerald-700 hover:underline">
            Ir a TRD
          </Link>
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {TRD_GLOSSARY.map((g) => (
          <Card key={g.term}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{g.term}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-600">{g.definition}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
