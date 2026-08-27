import { NextResponse } from "next/server";
import { getSession, requirePermission } from "@/shared/kernel/auth";
import { AppError, jsonError } from "@/shared/kernel/http";
import { buildImportTemplate } from "@/modules/search-reports";

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

export async function POST() {
  return jsonError(
    new AppError(
      "Use POST /api/v1/uploads/intent (purpose=import), PUT a la URL firmada y POST /api/v1/uploads/complete",
      410
    )
  );
}
