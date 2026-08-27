import { NextRequest } from "next/server";
import { z } from "zod";
import { DocumentSupport } from "@prisma/client";
import { getSession, requirePermission, requireAnyPermission } from "@/shared/kernel/auth";
import { jsonOk, jsonError, writeAudit, AppError } from "@/shared/kernel/http";
import {
  approveByArchive,
  approveByDept,
  listWorkflowInbox,
  rejectByArchive,
  rejectByDept,
  resubmitDocument,
  startDeptReview,
  submitDocumentForReview,
} from "@/modules/documents";

const submitSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  dependencyId: z.string().min(1),
  expedienteId: z.string().optional(),
  documentTypeId: z.string().optional(),
  seriesId: z.string().optional(),
  subseriesId: z.string().optional(),
  folioCount: z.number().int().min(1).optional(),
  observations: z.string().optional(),
  responsibleId: z.string().optional(),
  documentDate: z.string().optional(),
  support: z.nativeEnum(DocumentSupport).optional(),
  electronicFormat: z.string().optional(),
  fileName: z.string().optional(),
});

const actionSchema = z.object({
  action: z.enum([
    "approve_dept",
    "reject_dept",
    "approve_archive",
    "reject_archive",
    "resubmit",
    "start_dept_review",
  ]),
  documentId: z.string().min(1),
  observations: z.string().optional(),
});

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);
    requirePermission(user, "documents.read");
    const items = await listWorkflowInbox(user);
    return jsonOk({ items });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new AppError("No autenticado", 401);

    const body = await req.json();

    // Nueva carga para revisión
    if (body?.action === "submit" || (!body?.action && body?.name)) {
      requirePermission(user, "documents.create");
      const data = submitSchema.parse(body);
      const doc = await submitDocumentForReview(user, data);
      await writeAudit({
        user,
        action: "DOCUMENT_SUBMIT_REVIEW",
        module: "documents",
        entityType: "Document",
        entityId: doc.id,
        changes: { code: doc.code, status: doc.status },
        req,
      });
      return jsonOk(doc, 201);
    }

    const parsed = actionSchema.parse(body);
    requireAnyPermission(user, ["documents.approve", "documents.update"]);
    let result;

    switch (parsed.action) {
      case "start_dept_review":
        result = await startDeptReview(user, parsed.documentId);
        break;
      case "approve_dept":
        result = await approveByDept(user, parsed.documentId, parsed.observations);
        break;
      case "reject_dept":
        result = await rejectByDept(
          user,
          parsed.documentId,
          parsed.observations ?? ""
        );
        break;
      case "approve_archive":
        result = await approveByArchive(user, parsed.documentId, parsed.observations);
        break;
      case "reject_archive":
        result = await rejectByArchive(
          user,
          parsed.documentId,
          parsed.observations ?? ""
        );
        break;
      case "resubmit":
        result = await resubmitDocument(user, parsed.documentId, parsed.observations);
        break;
      default:
        throw new AppError("Acción no soportada", 400);
    }

    await writeAudit({
      user,
      action: `DOCUMENT_WORKFLOW_${parsed.action.toUpperCase()}`,
      module: "documents",
      entityType: "Document",
      entityId: parsed.documentId,
      changes: { status: result.status, observations: parsed.observations },
      req,
    });

    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
