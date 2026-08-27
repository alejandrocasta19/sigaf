"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, History, Paperclip, Loader2, Eye } from "lucide-react";
import { directUpload } from "@/shared/ui/direct-upload";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { formatDate } from "@/shared/kernel/utils";

type Version = {
  id: string;
  version: number;
  filePath: string | null;
  fileHash: string | null;
  changeNote: string | null;
  createdAt: string | Date;
  createdBy: { firstName: string; lastName: string } | null;
};

type Attachment = {
  id: string;
  name: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string | Date;
};

export function DocumentFilesPanel({
  documentId,
  versions: initialVersions,
  attachments: initialAttachments,
  canUpload,
}: {
  documentId: string;
  versions: Version[];
  attachments: Attachment[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const [versions, setVersions] = useState(initialVersions);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [note, setNote] = useState("");
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [uploadingAtt, setUploadingAtt] = useState(false);

  async function uploadVersion(file: File | null) {
    if (!file) return;
    setUploadingVersion(true);
    try {
      const result = await directUpload(file, {
        purpose: "version",
        targetId: documentId,
        extra: note ? { changeNote: note } : undefined,
      });
      const data = (result as { data?: Version }).data;
      if (data) setVersions((prev) => [data, ...prev]);
      setNote("");
      toast.success(`Versión ${data?.version ?? ""} creada`.trim());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setUploadingVersion(false);
    }
  }

  async function uploadAttachment(file: File | null) {
    if (!file) return;
    setUploadingAtt(true);
    try {
      const result = await directUpload(file, {
        purpose: "attachment",
        targetId: documentId,
      });
      const data = (result as { data?: Attachment }).data;
      if (data) setAttachments((prev) => [data, ...prev]);
      toast.success("Anexo cargado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setUploadingAtt(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            Historial de versiones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canUpload && (
            <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-3">
              <div className="space-y-1.5">
                <Label>Nota de cambio (opcional)</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ej. Corrección de folios"
                />
              </div>
              <label className="inline-flex cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  disabled={uploadingVersion}
                  onChange={(e) => uploadVersion(e.target.files?.[0] ?? null)}
                />
                <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">
                  {uploadingVersion ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Nueva versión
                </span>
              </label>
            </div>
          )}

          <ul className="space-y-2">
            {versions.length === 0 && (
              <li className="text-sm text-slate-500">Sin versiones cargadas</li>
            )}
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-800">Versión {v.version}</p>
                  <p className="text-xs text-slate-500">
                    {v.createdBy
                      ? `${v.createdBy.firstName} ${v.createdBy.lastName}`
                      : "Sistema"}{" "}
                    · {formatDate(v.createdAt)}
                  </p>
                  {v.changeNote && (
                    <p className="text-xs text-slate-600">{v.changeNote}</p>
                  )}
                  {v.fileHash && (
                    <p className="truncate font-mono text-[10px] text-slate-400">
                      SHA256: {v.fileHash.slice(0, 16)}…
                    </p>
                  )}
                </div>
                {v.filePath && (
                  <div className="flex gap-1">
                    <a
                      href={`/api/v1/files?type=version&id=${v.id}&disposition=inline`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button size="sm" variant="outline" type="button">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                    <a href={`/api/v1/files?type=version&id=${v.id}`}>
                      <Button size="sm" variant="outline" type="button">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-emerald-600" />
            Anexos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canUpload && (
            <label className="inline-flex cursor-pointer">
              <input
                type="file"
                className="hidden"
                disabled={uploadingAtt}
                onChange={(e) => uploadAttachment(e.target.files?.[0] ?? null)}
              />
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700">
                {uploadingAtt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Subir anexo
              </span>
            </label>
          )}

          <ul className="space-y-2">
            {attachments.length === 0 && (
              <li className="text-sm text-slate-500">Sin anexos</li>
            )}
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{a.name}</p>
                  <p className="text-xs text-slate-500">
                    {a.sizeBytes != null
                      ? `${(a.sizeBytes / 1024).toFixed(1)} KB`
                      : "—"}{" "}
                    · {formatDate(a.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <a
                    href={`/api/v1/files?type=attachment&id=${a.id}&disposition=inline`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" variant="outline" type="button">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  <a href={`/api/v1/files?type=attachment&id=${a.id}`}>
                    <Button size="sm" variant="outline" type="button">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
