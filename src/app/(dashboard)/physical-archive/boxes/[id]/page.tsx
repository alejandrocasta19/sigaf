import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Archive, Folder, History, Printer, QrCode } from "lucide-react";
import { getSession } from "@/shared/kernel/auth";
import { getBoxDetail } from "@/modules/physical-archive";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatDate } from "@/shared/kernel/utils";
import {
  documentStatusLabel,
  documentStatusVariant,
  StatusBadge,
} from "@/shared/list/status-labels";

type Props = { params: Promise<{ id: string }> };

export default async function BoxDetailPage({ params }: Props) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;
  const box = await getBoxDetail(user, id);
  if (!box) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/physical-archive" className="text-sm text-blue-600 hover:underline">
            ← Archivo físico
          </Link>
          <h1 className="page-title mt-1 flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <Archive className="h-6 w-6 text-teal-700" />
            Caja {box.code}
          </h1>
          <p className="text-sm text-slate-500">{box.locationPath}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/v1/boxes/${box.id}/label`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            <Printer className="h-4 w-4" />
            Reimprimir etiqueta PDF + QR
          </a>
          <Link
            href="/qr"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <QrCode className="h-4 w-4" />
            Escáner QR
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Estado</p>
            <p className="mt-1 font-semibold text-slate-900">{box.status}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Capacidad</p>
            <p className="mt-1 font-semibold text-slate-900">
              {box.currentCount}/{box.capacity}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">Carpetas</p>
            <p className="mt-1 font-semibold text-slate-900">{box.folders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500">QR interno</p>
            <p className="mt-1 truncate font-mono text-xs text-slate-700">{box.qrCode}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Folder className="h-4 w-4" />
              Carpetas ({box.folders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {box.folders.length === 0 ? (
              <p className="text-sm text-slate-500">Sin carpetas en esta caja.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="pb-2 font-medium">Código</th>
                    <th className="pb-2 font-medium">Nombre</th>
                    <th className="pb-2 font-medium">Docs</th>
                  </tr>
                </thead>
                <tbody>
                  {box.folders.map((f) => (
                    <tr key={f.id} className="border-b border-slate-50">
                      <td className="py-2">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: f.color }}
                        />
                        <span className="font-medium">{f.code}</span>
                      </td>
                      <td className="py-2 text-slate-600">{f.name ?? "—"}</td>
                      <td className="py-2 text-slate-600">{f._count.documents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expedientes ({box.expedientes.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {box.expedientes.length === 0 ? (
              <p className="text-sm text-slate-500">
                Ningún expediente con código de caja {box.code}.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="pb-2 font-medium">Código</th>
                    <th className="pb-2 font-medium">Asunto</th>
                    <th className="pb-2 font-medium">Serie</th>
                    <th className="pb-2 font-medium">Carpeta</th>
                  </tr>
                </thead>
                <tbody>
                  {box.expedientes.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50">
                      <td className="py-2">
                        <Link
                          href={`/expedientes/${e.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {e.code}
                        </Link>
                      </td>
                      <td className="py-2 text-slate-700">{e.subject ?? e.name}</td>
                      <td className="py-2">
                        {e.series?.name ? (
                          <span className="text-slate-600">{e.series.name}</span>
                        ) : (
                          <Badge variant="warning">Sin serie TRD</Badge>
                        )}
                      </td>
                      <td className="py-2 text-slate-600">{e.folderNumber ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Historial
          </CardTitle>
        </CardHeader>
        <CardContent>
          {box.history.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sin eventos de auditoría asociados aún. Al reimprimir la etiqueta se registrará
              aquí.
            </p>
          ) : (
            <ul className="space-y-2">
              {box.history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">{h.action}</p>
                    <p className="text-xs text-slate-500">
                      {h.user
                        ? `${h.user.firstName} ${h.user.lastName}`
                        : "Sistema"}{" "}
                      · {h.module}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {box.folders.some((f) => f.documents.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos recientes en carpetas</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="pb-2 font-medium">Documento</th>
                  <th className="pb-2 font-medium">Carpeta</th>
                  <th className="pb-2 font-medium">Expediente</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {box.folders.flatMap((f) =>
                  f.documents.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50">
                      <td className="py-2">
                        <Link
                          href={`/documents/${d.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {d.code}
                        </Link>
                        <p className="text-xs text-slate-500">{d.name}</p>
                      </td>
                      <td className="py-2 text-slate-600">{f.code}</td>
                      <td className="py-2 text-slate-600">
                        {d.expediente ? (
                          <Link
                            href={`/expedientes/${d.expediente.id}`}
                            className="hover:underline"
                          >
                            {d.expediente.code}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2">
                        <StatusBadge
                          label={documentStatusLabel(d.status)}
                          variant={documentStatusVariant(d.status)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
