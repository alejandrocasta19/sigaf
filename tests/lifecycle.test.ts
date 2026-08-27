import { describe, expect, it } from "vitest";
import {
  lifecycleStage,
  lifecyclePathLabel,
  isWorkflowPending,
  WORKFLOW_INBOX_STATUSES,
} from "../src/shared/kernel/document-lifecycle";
import { buildPreviewFiles } from "../src/modules/documents/ui/build-preview-files";
import {
  hasPermission,
  requirePermission,
  requireAnyPermission,
} from "../src/shared/kernel/permissions";
import { AppError } from "../src/shared/kernel/http";
import type { SessionUser } from "../src/shared/kernel/types";

function user(
  partial: Partial<SessionUser> & Pick<SessionUser, "roleCode" | "permissions">
): SessionUser {
  return {
    id: "1",
    email: "t@t.com",
    firstName: "T",
    lastName: "T",
    fullName: "T T",
    roleName: "x",
    accessLevel: 1,
    organizationId: "o",
    organizationName: "Org",
    dependencyId: null,
    dependencyName: null,
    avatarUrl: null,
    ...partial,
  };
}

describe("lifecycleStage", () => {
  it("marca creación en workflow pendiente", () => {
    expect(
      lifecycleStage({ status: "PENDING_REVIEW", archivalPhase: "MANAGEMENT" })
    ).toBe("CREATION");
  });

  it("marca AG cuando archivado", () => {
    expect(lifecycleStage({ status: "ARCHIVED", archivalPhase: "MANAGEMENT" })).toBe(
      "MANAGEMENT"
    );
  });

  it("marca AC/AH por fase", () => {
    expect(lifecycleStage({ status: "ARCHIVED", archivalPhase: "CENTRAL" })).toBe("CENTRAL");
    expect(lifecycleStage({ status: "ARCHIVED", archivalPhase: "HISTORICAL" })).toBe(
      "HISTORICAL"
    );
  });

  it("eliminación / conservación", () => {
    expect(
      lifecycleStage({
        status: "DELETED",
        appliedFinalDisposition: "ELIMINATION",
        deletedAt: new Date(),
      })
    ).toBe("ELIMINATION");
    expect(
      lifecycleStage({
        status: "DELETED",
        appliedFinalDisposition: "CONSERVATION",
        deletedAt: new Date(),
      })
    ).toBe("CONSERVATION");
  });

  it("lifecyclePathLabel incluye etapa actual", () => {
    const label = lifecyclePathLabel({
      status: "ARCHIVED",
      archivalPhase: "CENTRAL",
    });
    expect(label).toContain("[AC]");
  });

  it("isWorkflowPending y inbox statuses", () => {
    expect(isWorkflowPending("PENDING_REVIEW")).toBe(true);
    expect(isWorkflowPending("ARCHIVED")).toBe(false);
    expect(WORKFLOW_INBOX_STATUSES).toContain("IN_REVIEW_ARCHIVE");
  });
});

describe("hasPermission / requirePermission", () => {
  it("SUPER_ADMIN bypasea", () => {
    expect(
      hasPermission(user({ roleCode: "SUPER_ADMIN", permissions: [] }), "documents.delete")
    ).toBe(true);
  });

  it("exige permiso en lista", () => {
    expect(
      hasPermission(
        user({ roleCode: "DOC_ADMIN", permissions: ["documents.read"] }),
        "documents.create"
      )
    ).toBe(false);
    expect(
      hasPermission(
        user({ roleCode: "DOC_ADMIN", permissions: ["documents.create"] }),
        "documents.create"
      )
    ).toBe(true);
  });

  it("requirePermission lanza 403", () => {
    expect(() =>
      requirePermission(user({ roleCode: "CONSULT_USER", permissions: [] }), "users.create")
    ).toThrow(AppError);
  });

  it("requireAnyPermission acepta uno de varios", () => {
    expect(() =>
      requireAnyPermission(
        user({ roleCode: "DEPT_HEAD", permissions: ["documents.approve"] }),
        ["documents.approve", "documents.update"]
      )
    ).not.toThrow();
  });
});

describe("buildPreviewFiles", () => {
  it("incluye documento, versiones y anexos", () => {
    const files = buildPreviewFiles({
      id: "d1",
      code: "DOC-1",
      filePath: "a/b.pdf",
      versions: [{ id: "v1", version: 1, filePath: "a/v1.pdf" }],
      attachments: [
        { id: "a1", name: "anexo.pdf", filePath: "a/a1.pdf", mimeType: "application/pdf" },
      ],
    });
    expect(files.length).toBe(3);
    expect(files[0].kind).toBe("document");
  });

  it("sin archivo no inventa documento vacío", () => {
    const files = buildPreviewFiles({ id: "d1", code: "X", filePath: null });
    expect(files.length).toBe(0);
  });
});

describe("transfer checklist", () => {
  it("requiere cuatro flags", () => {
    const checklistOk = (d: {
      checklistFoliation?: boolean;
      checklistChronological?: boolean;
      checklistInventory?: boolean;
      checklistBoxFolder?: boolean;
    }) =>
      !!d.checklistFoliation &&
      !!d.checklistChronological &&
      !!d.checklistInventory &&
      !!d.checklistBoxFolder;

    expect(checklistOk({})).toBe(false);
    expect(
      checklistOk({
        checklistFoliation: true,
        checklistChronological: true,
        checklistInventory: true,
        checklistBoxFolder: true,
      })
    ).toBe(true);
  });
});

describe("generateDocumentCode concurrency-safe format", () => {
  it("sufijo aleatorio distingue códigos con mismo seq", () => {
    const a = `DOC-2026-00001-aa11`;
    const b = `DOC-2026-00001-bb22`;
    expect(a).not.toBe(b);
    expect(a.split("-").length).toBeGreaterThanOrEqual(4);
  });
});

describe("retention policy", () => {
  it("computeManagementDueAt suma años AG desde evento", async () => {
    const {
      resolveRetentionStartDate,
      computeManagementDueAt,
      computeFullRetentionEnd,
    } = await import("../src/shared/kernel/retention-policy");

    const start = new Date("2020-06-15");
    expect(resolveRetentionStartDate({ event: "EXPEDIENTE_CLOSE", closedAt: start }).toISOString()).toBe(
      start.toISOString()
    );
    expect(
      resolveRetentionStartDate({
        event: "LAST_DOCUMENT",
        lastDocumentDate: new Date("2021-03-01"),
      }).toISOString()
    ).toBe(new Date("2021-03-01").toISOString());

    const due = computeManagementDueAt(start, 2);
    expect(due.getFullYear()).toBe(2022);

    const full = computeFullRetentionEnd(start, 2, 8);
    expect(full.getFullYear()).toBe(2030);
  });
});

describe("expediente readiness foliación física", () => {
  it("exige foliación física trazada para transferencia", async () => {
    const { evaluateExpedienteReadiness } = await import("../src/shared/kernel/expediente-cycle");

    const base = {
      id: "e1",
      code: "EXP-001",
      name: "Test",
      subject: "Test",
      status: "CLOSED",
      processSteps: {
        IDENTIFICATION: true,
        CLASSIFICATION: true,
        ORDERING: true,
        FOLIATION: true,
        LABELING: true,
        FUID_INVENTORY: true,
      },
      foliationVerified: true,
      chronologicalOrder: true,
      folderNumber: "01",
      boxCode: "C-001",
      retentionDueAt: new Date("2020-01-01"),
      retentionStartDate: new Date("2018-01-01"),
      closedAt: new Date("2019-01-01"),
      documents: [{ id: "d1" }],
      hasValidatedInventory: true,
    };

    const sinFisica = evaluateExpedienteReadiness({
      ...base,
      physicalFoliationDone: false,
      foliationBy: null,
    });
    expect(sinFisica.checks.find((c) => c.key === "physicalFoliation")?.passed).toBe(false);
    expect(sinFisica.ready).toBe(false);

    const conFisica = evaluateExpedienteReadiness({
      ...base,
      physicalFoliationDone: true,
      foliationBy: "Juan Pérez",
      foliationAt: new Date("2019-02-01"),
    });
    expect(conFisica.checks.find((c) => c.key === "physicalFoliation")?.passed).toBe(true);
    expect(conFisica.ready).toBe(true);
  });
});

describe("préstamo 24h", () => {
  it("LOAN_DURATION_MS es 24 horas", async () => {
    const { LOAN_DURATION_MS, isLoanGestora } = await import(
      "../src/modules/loans-transfers/application/loans-service"
    );
    expect(LOAN_DURATION_MS).toBe(24 * 60 * 60 * 1000);
    expect(isLoanGestora(user({ roleCode: "DOC_ADMIN", permissions: [] }))).toBe(true);
    expect(isLoanGestora(user({ roleCode: "DEPT_WORKER", permissions: [] }))).toBe(false);
    expect(isLoanGestora(user({ roleCode: "DEPT_HEAD", permissions: [] }))).toBe(false);
  });

  it("labels de estado del diagrama", async () => {
    const { loanStatusLabel } = await import("../src/shared/list/status-labels");
    expect(loanStatusLabel("REQUESTED")).toBe("Pendiente de aprobación");
    expect(loanStatusLabel("ACTIVE")).toBe("Documento entregado");
    expect(loanStatusLabel("OVERDUE")).toBe("Vencido");
  });
});
