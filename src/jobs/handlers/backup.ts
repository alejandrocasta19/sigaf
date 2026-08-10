import { execFile } from "child_process";
import { promisify } from "util";
import { readdir, stat } from "fs/promises";
import path from "path";
import { prisma } from "@/shared/kernel/prisma";
import { ensureUploadDir, saveUpload } from "@/shared/kernel/storage";

const execFileAsync = promisify(execFile);

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await collectFiles(full)));
    else files.push(full);
  }
  return files;
}

async function zipUploadsManifest(orgId: string): Promise<Buffer> {
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "./uploads");
  const orgDir = path.join(uploadRoot, orgId);
  const files = await collectFiles(orgDir).catch(() => [] as string[]);
  const lines = [`Backup uploads ${orgId} ${new Date().toISOString()}`, `files=${files.length}`];
  for (const f of files.slice(0, 5000)) {
    const s = await stat(f).catch(() => null);
    lines.push(`${path.relative(uploadRoot, f)}\t${s?.size ?? 0}`);
  }
  return Buffer.from(lines.join("\n"), "utf8");
}

export async function runBackupJob(organizationId: string, _payload: unknown) {
  const notes: string[] = [];
  let sizeBytes = 0;
  let filePath = "";
  let status = "COMPLETED";

  try {
    const listBuf = await zipUploadsManifest(organizationId);
    const saved = await saveUpload({
      orgId: organizationId,
      category: "backups",
      originalName: `uploads-manifest-${Date.now()}.txt`,
      buffer: listBuf,
    });
    filePath = saved.relativePath;
    sizeBytes += saved.sizeBytes;
    notes.push(`Manifest uploads: ${saved.relativePath}`);
  } catch (e) {
    notes.push(`uploads: ${e instanceof Error ? e.message : "error"}`);
    status = "PARTIAL";
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const stamp = Date.now();
      const dir = await ensureUploadDir(organizationId, "backups");
      const dumpFile = path.join(dir, `pg-${stamp}.sql`);
      await execFileAsync("pg_dump", [databaseUrl, "-f", dumpFile], {
        timeout: 120_000,
        windowsHide: true,
      });
      const s = await stat(dumpFile);
      const rel = path.join(organizationId, "backups", `pg-${stamp}.sql`).replace(/\\/g, "/");
      if (!filePath) filePath = rel;
      sizeBytes += s.size;
      notes.push(`pg_dump: ${rel}`);
    } catch (e) {
      notes.push(`pg_dump no disponible: ${e instanceof Error ? e.message : "error"}`);
      if (status === "COMPLETED") status = "PARTIAL";
    }
  }

  const record = await prisma.backupRecord.create({
    data: {
      organizationId,
      filePath: filePath || `backups/${organizationId}/empty`,
      sizeBytes,
      status,
    },
  });

  return { recordId: record.id, status, notes, sizeBytes, filePath };
}
