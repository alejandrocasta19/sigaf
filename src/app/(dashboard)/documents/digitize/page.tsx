import Link from "next/link";
import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { DigitizeUploadButton } from "@/modules/documents/ui/digitize-upload-button";
import { formatDate } from "@/shared/kernel/utils";

export default async function DigitizePage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const pending = await prisma.document.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      filePath: null,
    },
    include: { dependency: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Digitalización</h1>
        <p className="text-sm text-slate-500">
          Suba PDF o imagen; el texto de PDF se indexa para búsqueda
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documentos sin archivo digital ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Código</th>
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">Dependencia</th>
                <th className="pb-3 font-medium">Registrado</th>
                <th className="pb-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="py-3">
                    <Link href={`/documents/${d.id}`} className="font-medium text-blue-700 hover:underline">
                      {d.code}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-800">{d.name}</td>
                  <td className="py-3 text-slate-600">{d.dependency.name}</td>
                  <td className="py-3 text-slate-500">{formatDate(d.createdAt)}</td>
                  <td className="py-3">
                    <DigitizeUploadButton documentId={d.id} />
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Todos los documentos tienen archivo digital
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
