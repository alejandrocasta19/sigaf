export type PreviewFile = {
  kind: "document" | "version" | "attachment";
  id: string;
  label: string;
  mimeHint?: string | null;
  filePath?: string | null;
};

export function buildPreviewFiles(doc: {
  id: string;
  code: string;
  filePath?: string | null;
  versions?: Array<{ id: string; version: number; filePath: string | null }>;
  attachments?: Array<{
    id: string;
    name: string;
    filePath: string;
    mimeType?: string | null;
  }>;
}): PreviewFile[] {
  const files: PreviewFile[] = [];

  if (doc.filePath) {
    files.push({
      kind: "document",
      id: doc.id,
      label: `Documento actual (${doc.code})`,
      filePath: doc.filePath,
    });
  }

  for (const v of doc.versions ?? []) {
    if (!v.filePath) continue;
    if (doc.filePath && v.filePath === doc.filePath && files.length > 0) continue;
    files.push({
      kind: "version",
      id: v.id,
      label: `Versión ${v.version}`,
      filePath: v.filePath,
    });
  }

  for (const a of doc.attachments ?? []) {
    files.push({
      kind: "attachment",
      id: a.id,
      label: a.name,
      filePath: a.filePath,
      mimeHint: a.mimeType,
    });
  }

  return files;
}
