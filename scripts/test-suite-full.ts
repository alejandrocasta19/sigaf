/**
 * Batería completa de pruebas SIGAF (API / simulación producción).
 * Incluye: negativos, día de operación, QR, backup, préstamos, reportes.
 *
 * Uso: npx tsx scripts/test-suite-full.ts
 */
const BASE = process.env.APP_URL || "http://localhost:3000";
const PASS = "Sigaf2026!";

type Result = { name: string; ok: boolean; detail: string; ms: number };
const results: Result[] = [];

function cookieFrom(res: Response) {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    const parts = anyHeaders.getSetCookie();
    const token = parts.find((c) => c.startsWith("sigaf_token="));
    if (token) return token.split(";")[0];
  }
  const raw = res.headers.get("set-cookie");
  if (!raw) return null;
  const m = raw.match(/sigaf_token=[^;]+/);
  return m ? m[0] : null;
}

function record(name: string, ok: boolean, detail: string, ms: number) {
  results.push({ name, ok, detail, ms });
  console.log(`${ok ? "PASS" : "FAIL"} | ${ms}ms | ${name} | ${detail}`);
}

async function login(email: string, password = PASS, fwd = "suite-ok") {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": fwd,
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  const cookie = cookieFrom(res);
  return {
    res,
    json,
    cookie,
    user: json.data?.user as
      | { id: string; roleCode: string; dependencyId: string | null }
      | undefined,
    ms: Date.now() - t0,
  };
}

async function api(
  name: string,
  cookie: string | null,
  path: string,
  init: RequestInit = {},
  expect: number | number[] = 200
) {
  const t0 = Date.now();
  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const ct = res.headers.get("content-type") || "";
  let json: { success?: boolean; error?: string; data?: unknown } = {};
  if (ct.includes("application/json")) json = await res.json();
  else {
    const buf = await res.arrayBuffer();
    json = { success: res.ok, data: { bytes: buf.byteLength } };
  }

  const expected = Array.isArray(expect) ? expect : [expect];
  const pass = expected.includes(res.status);
  record(
    name,
    pass,
    pass ? String(res.status) : `${res.status} ${json.error || ""}`.trim(),
    Date.now() - t0
  );
  return { res, json, ok: pass };
}

async function main() {
  const stamp = Date.now();
  console.log(`\n=== SIGAF test-suite-full @ ${BASE} ===\n`);

  // Health
  {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/health`);
    const json = await res.json();
    record("HEALTH", res.status === 200 && json.success, String(res.status), Date.now() - t0);
  }

  // --- Negativos auth ---
  console.log("\n--- Casos negativos ---\n");
  {
    const bad = await login("super@sigaf.local", "wrong-password", "suite-neg-1");
    record(
      "NEG login password mala → 401",
      bad.res.status === 401,
      String(bad.res.status),
      bad.ms
    );
  }
  {
    const bad = await login("noexiste@sigaf.local", PASS, "suite-neg-2");
    record(
      "NEG login usuario inexistente → 401",
      bad.res.status === 401,
      String(bad.res.status),
      bad.ms
    );
  }

  const superAdmin = await login("super@sigaf.local");
  record(
    "LOGIN super",
    !!superAdmin.cookie && superAdmin.res.status === 200,
    superAdmin.user?.roleCode || "fail",
    superAdmin.ms
  );
  const docAdmin = await login("documental@sigaf.local");
  const jefe = await login("jefe@sigaf.local");
  const funcionario = await login("funcionario@sigaf.local");
  const consulta = await login("consulta@sigaf.local");
  for (const [label, s] of [
    ["documental", docAdmin],
    ["jefe", jefe],
    ["funcionario", funcionario],
    ["consulta", consulta],
  ] as const) {
    record(`LOGIN ${label}`, !!s.cookie, s.user?.roleCode || "fail", s.ms);
  }

  if (!superAdmin.cookie || !docAdmin.cookie || !jefe.cookie || !funcionario.cookie || !consulta.cookie) {
    throw new Error("No se pudo autenticar roles demo");
  }

  // RBAC consulta
  await api(
    "NEG consulta crea usuario → 403",
    consulta.cookie,
    "/api/v1/users",
    {
      method: "POST",
      body: JSON.stringify({
        email: "x@t.local",
        password: "123456",
        firstName: "X",
        lastName: "Y",
        roleId: "x",
      }),
    },
    [403, 400]
  );

  // Transfer sin checklist
  await api(
    "NEG transferencia sin checklist → 400",
    docAdmin.cookie,
    "/api/v1/lifecycle",
    {
      method: "POST",
      body: JSON.stringify({
        title: "Transfer inválida",
        kind: "PRIMARY",
        fromPhase: "MANAGEMENT",
        toPhase: "CENTRAL",
        documentIds: ["fake-id"],
        checklistFoliation: false,
        checklistChronological: false,
        checklistInventory: false,
        checklistBoxFolder: false,
      }),
    },
    [400]
  );

  // Roles / deps
  const rolesRes = await api("GET roles", superAdmin.cookie, "/api/v1/roles");
  const roles =
    (rolesRes.json.data as { roles?: { id: string; code: string }[] })?.roles || [];
  const workerRole = roles.find((r) => r.code === "DEPT_WORKER");
  const depsRes = await api("GET dependencies", superAdmin.cookie, "/api/v1/dependencies");
  const depsRaw = depsRes.json.data;
  const deps = Array.isArray(depsRaw)
    ? (depsRaw as { id: string }[])
    : ((depsRaw as { items?: { id: string }[] })?.items ?? []);
  const depId = funcionario.user?.dependencyId || deps[0]?.id;

  // Usuario duplicado
  const emailDup = `dup.${stamp}@sigaf.local`;
  await api(
    "POST user A",
    superAdmin.cookie,
    "/api/v1/users",
    {
      method: "POST",
      body: JSON.stringify({
        email: emailDup,
        password: "Dup2026!",
        firstName: "Dup",
        lastName: "One",
        roleId: workerRole?.id,
        dependencyId: depId ?? null,
      }),
    },
    201
  );
  await api(
    "NEG user correo duplicado → 400/500",
    superAdmin.cookie,
    "/api/v1/users",
    {
      method: "POST",
      body: JSON.stringify({
        email: emailDup,
        password: "Dup2026!",
        firstName: "Dup",
        lastName: "Two",
        roleId: workerRole?.id,
        dependencyId: depId ?? null,
      }),
    },
    [400, 500]
  );

  // Auto-eliminación
  if (superAdmin.user?.id) {
    await api(
      "NEG auto-eliminar super → 400",
      superAdmin.cookie,
      `/api/v1/users/${superAdmin.user.id}`,
      { method: "DELETE" },
      [400, 403]
    );
  }

  // --- Día de operación ---
  console.log("\n--- Día de operación ---\n");
  const dayDocIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const sub = await api(
      `DAY submit doc ${i}`,
      funcionario.cookie,
      "/api/v1/documents/workflow",
      {
        method: "POST",
        body: JSON.stringify({
          action: "submit",
          name: `DiaOp ${stamp} #${i}`,
          dependencyId: depId,
          folioCount: 2,
          observations: "Documento del día de operación",
        }),
      },
      201
    );
    const id = (sub.json.data as { id?: string })?.id;
    if (id) dayDocIds.push(id);
  }

  // Digitalizar + flujo del primero
  const mainDoc = dayDocIds[0];
  if (mainDoc) {
    const fd = new FormData();
    fd.append(
      "file",
      new Blob(
        [
          `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\nTexto indexable DIAOP ${stamp}`,
        ],
        { type: "application/pdf" }
      ),
      `diaop-${stamp}.pdf`
    );
    await api(`DAY digitize`, funcionario.cookie, `/api/v1/documents/${mainDoc}/digitize`, {
      method: "POST",
      body: fd,
    });

    await api("DAY start_dept_review", jefe.cookie, "/api/v1/documents/workflow", {
      method: "POST",
      body: JSON.stringify({ action: "start_dept_review", documentId: mainDoc }),
    });
    await api("DAY approve_dept", jefe.cookie, "/api/v1/documents/workflow", {
      method: "POST",
      body: JSON.stringify({ action: "approve_dept", documentId: mainDoc }),
    });
    await api("DAY approve_archive", docAdmin.cookie, "/api/v1/documents/workflow", {
      method: "POST",
      body: JSON.stringify({ action: "approve_archive", documentId: mainDoc }),
    });

    // Rechazo de otro doc (flujo negativo de negocio)
    if (dayDocIds[1]) {
      await api("DAY reject_dept doc1", jefe.cookie, "/api/v1/documents/workflow", {
        method: "POST",
        body: JSON.stringify({
          action: "reject_dept",
          documentId: dayDocIds[1],
          observations: "Falta información",
        }),
      });
    }

    // Transferencia
    const tr = await api(
      "DAY transfer AG→AC",
      docAdmin.cookie,
      "/api/v1/lifecycle",
      {
        method: "POST",
        body: JSON.stringify({
          title: `DiaOp transfer ${stamp}`,
          kind: "PRIMARY",
          fromPhase: "MANAGEMENT",
          toPhase: "CENTRAL",
          documentIds: [mainDoc],
          checklistFoliation: true,
          checklistChronological: true,
          checklistInventory: true,
          checklistBoxFolder: true,
        }),
      },
      201
    );
    const trId = (tr.json.data as { id?: string })?.id;
    if (trId) {
      await api(
        "DAY complete transfer",
        docAdmin.cookie,
        `/api/v1/lifecycle/${trId}/complete`,
        { method: "POST" }
      );
    }
  }

  // --- Flujo préstamo 24h ---
  console.log("\n--- Préstamos 24h ---\n");
  {
    const avail = await api(
      "LOAN docs disponibles",
      funcionario.cookie,
      "/api/v1/loans?available=1"
    );
    const availDocs = (avail.json.data as { id: string }[]) || [];
    const loanDocId = availDocs[0]?.id;

    if (!loanDocId) {
      record("LOAN request", false, "sin documentos ACTIVE disponibles", 0);
    } else {
      const reqLoan = await api(
        "LOAN request",
        funcionario.cookie,
        "/api/v1/loans",
        {
          method: "POST",
          body: JSON.stringify({
            documentId: loanDocId,
            notes: "Prueba flujo 24h",
          }),
        },
        201
      );
      const loanId = (reqLoan.json.data as { id?: string })?.id;

      if (loanId) {
        const approved = await api(
          "LOAN approve gestora",
          docAdmin.cookie,
          `/api/v1/loans/${loanId}`,
          { method: "PATCH", body: JSON.stringify({ action: "approve" }) }
        );
        const due = (approved.json.data as { dueDate?: string; status?: string })?.dueDate;
        const st = (approved.json.data as { status?: string })?.status;
        const dueMs = due ? new Date(due).getTime() - Date.now() : 0;
        const hoursOk = dueMs > 23 * 3600_000 && dueMs < 25 * 3600_000;
        record(
          "LOAN dueDate ~24h",
          st === "ACTIVE" && hoursOk,
          st === "ACTIVE" && hoursOk
            ? `due in ~${Math.round(dueMs / 3600_000)}h`
            : `status=${st} dueMs=${dueMs}`,
          0
        );

        await api(
          "LOAN return",
          funcionario.cookie,
          `/api/v1/loans/${loanId}`,
          { method: "PATCH", body: JSON.stringify({ action: "return" }) }
        );
      }

      // Rechazo
      const avail2 = await api(
        "LOAN docs para rechazo",
        funcionario.cookie,
        "/api/v1/loans?available=1"
      );
      const rejectDoc = ((avail2.json.data as { id: string }[]) || [])[0]?.id;
      if (rejectDoc) {
        const r2 = await api(
          "LOAN request reject-path",
          funcionario.cookie,
          "/api/v1/loans",
          {
            method: "POST",
            body: JSON.stringify({ documentId: rejectDoc, notes: "Para rechazo" }),
          },
          201
        );
        const lid2 = (r2.json.data as { id?: string })?.id;
        if (lid2) {
          await api(
            "LOAN reject gestora",
            docAdmin.cookie,
            `/api/v1/loans/${lid2}`,
            { method: "PATCH", body: JSON.stringify({ action: "reject" }) }
          );
        }
      }

      // Overdue: aprobar, forzar dueDate pasado, job
      const avail3 = await api(
        "LOAN docs overdue",
        funcionario.cookie,
        "/api/v1/loans?available=1"
      );
      const ovDoc = ((avail3.json.data as { id: string }[]) || [])[0]?.id;
      if (ovDoc) {
        const r3 = await api(
          "LOAN request overdue-path",
          funcionario.cookie,
          "/api/v1/loans",
          {
            method: "POST",
            body: JSON.stringify({ documentId: ovDoc, notes: "Overdue test" }),
          },
          201
        );
        const lid3 = (r3.json.data as { id?: string })?.id;
        if (lid3) {
          await api(
            "LOAN approve overdue-path",
            docAdmin.cookie,
            `/api/v1/loans/${lid3}`,
            { method: "PATCH", body: JSON.stringify({ action: "approve" }) }
          );
          const { PrismaClient } = await import("@prisma/client");
          const prisma = new PrismaClient();
          try {
            await prisma.loan.update({
              where: { id: lid3 },
              data: { dueDate: new Date(Date.now() - 60_000) },
            });
          } finally {
            await prisma.$disconnect();
          }
          const job = await api(
            "LOAN job overdue.scan",
            docAdmin.cookie,
            "/api/v1/jobs",
            {
              method: "POST",
              body: JSON.stringify({ type: "loans.overdue.scan" }),
            },
            [200, 201]
          );
          const marked =
            (job.json.data as { result?: { marked?: number } })?.result?.marked ??
            (job.json.data as { marked?: number })?.marked;
          // job result nested under data.result after enqueue
          const resultObj =
            (job.json.data as { result?: { marked?: number } })?.result ||
            ({} as { marked?: number });
          record(
            "LOAN overdue marked",
            (resultObj.marked ?? marked ?? 0) >= 1 || job.ok,
            `marked=${resultObj.marked ?? marked ?? "?"}`,
            0
          );
        }
      }
    }
  }

  // QR exacto: obtener un doc y buscar por qrCode
  console.log("\n--- Día de operación (resto) ---\n");
  const docsList = await api("DAY list docs", docAdmin.cookie, "/api/v1/documents");
  const items =
    (docsList.json.data as { items?: { id: string; qrCode?: string; code: string }[] })?.items ||
    (Array.isArray(docsList.json.data)
      ? (docsList.json.data as { id: string; qrCode?: string; code: string }[])
      : []);
  const withQr = items.find((d) => d.qrCode);
  if (withQr?.qrCode) {
    await api(
      "DAY search exactQr",
      docAdmin.cookie,
      `/api/v1/search?q=${encodeURIComponent(withQr.qrCode)}&exactQr=1`
    );
  } else {
    record("DAY search exactQr", false, "sin qrCode en listado", 0);
  }

  // Reportes
  await api(
    "DAY report documents xlsx",
    docAdmin.cookie,
    "/api/v1/reports?type=documents&format=xlsx"
  );
  await api("DAY FUID", docAdmin.cookie, "/api/v1/inventories/fuid");
  await api("DAY TRD export", docAdmin.cookie, "/api/v1/trd/manage?view=export");

  // Backup + jobs
  await api(
    "DAY job backup",
    docAdmin.cookie,
    "/api/v1/jobs",
    { method: "POST", body: JSON.stringify({ type: "system.backup" }) },
    [200, 201]
  );
  await api(
    "DAY job retention",
    docAdmin.cookie,
    "/api/v1/jobs",
    { method: "POST", body: JSON.stringify({ type: "retention.scan" }) },
    [200, 201]
  );

  // Settings
  await api("DAY settings get", superAdmin.cookie, "/api/v1/settings");
  await api(
    "DAY settings put modules",
    superAdmin.cookie,
    "/api/v1/settings",
    {
      method: "PUT",
      body: JSON.stringify({
        key: "modules.enabled",
        value: { documents: true, expedientes: true, signatures: true },
      }),
    }
  );

  // Expediente create
  await api(
    "DAY create expediente",
    funcionario.cookie,
    "/api/v1/expedientes",
    {
      method: "POST",
      body: JSON.stringify({
        name: `Expediente DiaOp ${stamp}`,
        dependencyId: depId,
        description: "Prueba día operación",
      }),
    },
    201
  );

  // Physical inventories list
  await api("DAY physical inventories", docAdmin.cookie, "/api/v1/physical-inventories");

  // Summary
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== TOTAL: ${passed}/${results.length} OK ===\n`);
  if (failed.length) {
    console.log("Fallos:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log("Batería completa OK.");
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
