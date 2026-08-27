import { NextRequest } from "next/server";
import { getSession } from "@/shared/kernel/auth";
import { jsonError, AppError } from "@/shared/kernel/http";
import { buildBoxQrPayload } from "@/shared/kernel/qr-codes";
import { generateFolderLabelPdf, generateBoxLabelPdf, getExpedienteArchivalDetail } from "@/modules/expedientes";

type Ctx = { params: Promise<{ id: string }> };

function fmtDateParam(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO");
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") ?? "folder";
    const preview = sp.get("preview") === "1";
    const exp = await getExpedienteArchivalDetail(user, id);

    if (type === "folder") {
      const pdf = await generateFolderLabelPdf(user, id);
      const filename = `etiqueta-carpeta-${exp?.code ?? id}.pdf`;
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${filename}"`,
        },
      });
    }

    if (type === "box") {
      if (!exp) throw new AppError("Expediente no encontrado", 404);

      const boxCode = sp.get("boxCode") ?? exp.boxCode ?? "0001";
      const section = sp.get("section") ?? exp.dependency.name;
      const subsection = sp.get("subsection") ?? exp.subsection ?? exp.dependency.name;
      const series = sp.get("series") ?? exp.series?.name ?? "";
      const subseries = sp.get("subseries") ?? exp.subseries?.name ?? "";
      const code = sp.get("code") ?? exp.code;
      const folderRange = sp.get("folderRange") ?? exp.folderNumber ?? "001";
      const dateStart = sp.get("dateStart");
      const dateEnd = sp.get("dateEnd");
      const dateRange =
        sp.get("dateRange") ??
        `${dateStart ? new Date(dateStart).toLocaleDateString("es-CO") : fmtDateParam(exp.dateStart)} – ${dateEnd ? new Date(dateEnd).toLocaleDateString("es-CO") : fmtDateParam(exp.dateEnd)}`;

      const retentionLabel =
        exp.appliedRetentionMgmt != null
          ? `AG ${exp.appliedRetentionMgmt} / AC ${exp.appliedRetentionCentral ?? "—"} años`
          : undefined;

      const pdf = await generateBoxLabelPdf(user, {
        boxCode,
        section,
        subsection,
        series: series || undefined,
        subseries: subseries || undefined,
        expedienteCode: code,
        folderRange,
        dateRange,
        organizationName: exp.organization?.name,
        qrPayload: buildBoxQrPayload(boxCode),
        retentionLabel,
      });

      const filename = `etiqueta-caja-${boxCode}.pdf`;
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${filename}"`,
        },
      });
    }

    throw new AppError("Tipo de etiqueta no soportado", 400);
  } catch (e) {
    return jsonError(e);
  }
}
