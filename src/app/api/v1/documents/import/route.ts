import { NextRequest, NextResponse } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError, jsonOk, writeAudit } from "@/shared/kernel/http";
import { buildImportTemplate, importDocumentsFromExcel } from "@/modules/search-reports";
import { saveUpload } from "@/shared/kernel/storage";
import { assertAllowedUpload } from "@/shared/kernel/upload-policy";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.read");

    const buffer = await buildImportTemplate();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-documentos-sigaf.xlsx"',
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.create");

    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      throw new AppError("Debe adjuntar un archivo Excel (.xlsx)", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    assertAllowedUpload(file, buffer);

    await saveUpload({
      orgId: user.organizationId,
      category: "imports",
      originalName: file.name,
      buffer,
    });

    const result = await importDocumentsFromExcel(user, buffer);

    await writeAudit({
      user,
      action: "DOCUMENT_IMPORT",
      module: "documents",
      changes: { created: result.created, errors: result.errors.length },
    });

    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
