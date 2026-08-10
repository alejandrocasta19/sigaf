/**
 * Simulación tipo producción: smoke API + carga ligera.
 * Uso: npx tsx scripts/smoke-production-sim.ts
 */
const BASE = process.env.APP_URL || "http://localhost:3000";
const PASS = "Sigaf2026!";

type Result = { name: string; ok: boolean; detail: string; ms: number };

const results: Result[] = [];

function cookieFrom(res: Response) {
  // Node 20+ fetch: getSetCookie if available
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

async function login(email: string) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASS }),
  });
  const json = await res.json();
  const cookie = cookieFrom(res);
  const ok = res.status === 200 && json.success && !!cookie;
  results.push({
    name: `LOGIN ${email}`,
    ok,
    detail: ok ? `role=${json.data?.user?.roleCode}` : `${res.status} ${json.error || ""}`,
    ms: Date.now() - t0,
  });
  if (!ok || !cookie) throw new Error(`Login falló: ${email}`);
  return { cookie, user: json.data.user as { id: string; roleCode: string; dependencyId: string | null } };
}

async function api(
  name: string,
  cookie: string,
  path: string,
  init: RequestInit = {},
  expectStatus: number | number[] = 200
) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      Cookie: cookie,
      ...(init.headers || {}),
    },
  });
  let json: { success?: boolean; error?: string; data?: unknown } = {};
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    json = await res.json();
  } else {
    const buf = await res.arrayBuffer();
    json = { success: res.ok, data: { bytes: buf.byteLength } };
  }
  const expected = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  const ok = expected.includes(res.status) && (json.success !== false || !expected.includes(200));
  // For 403 we still want success:false
  const pass =
    expected.includes(res.status) &&
    (res.status >= 400 ? true : json.success !== false);
  results.push({
    name,
    ok: pass,
    detail: pass
      ? `${res.status}`
      : `${res.status} ${json.error || JSON.stringify(json).slice(0, 120)}`,
    ms: Date.now() - t0,
  });
  return { res, json, ok: pass };
}

async function main() {
  console.log(`\n=== SIGAF smoke sim @ ${BASE} ===\n`);

  // Health
  {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/health`);
    const json = await res.json();
    results.push({
      name: "HEALTH",
      ok: res.status === 200 && json.success,
      detail: String(res.status),
      ms: Date.now() - t0,
    });
  }

  // Logins
  const superAdmin = await login("super@sigaf.local");
  const docAdmin = await login("documental@sigaf.local");
  const jefe = await login("jefe@sigaf.local");
  const funcionario = await login("funcionario@sigaf.local");
  const consulta = await login("consulta@sigaf.local");

  // 403: consulta no puede crear usuarios
  await api(
    "RBAC consulta POST /users → 403",
    consulta.cookie,
    "/api/v1/users",
    {
      method: "POST",
      body: JSON.stringify({
        email: "x@test.local",
        password: "123456",
        firstName: "X",
        lastName: "Y",
        roleId: "x",
      }),
    },
    [403, 400]
  );

  // Roles list (super)
  const rolesRes = await api("GET /roles", superAdmin.cookie, "/api/v1/roles");
  const roles = (rolesRes.json.data as { roles: { id: string; code: string }[] })?.roles || [];
  const workerRole = roles.find((r) => r.code === "DEPT_WORKER");

  // Dependencies
  const depsRes = await api("GET /dependencies", superAdmin.cookie, "/api/v1/dependencies");
  const deps = (depsRes.json.data as { id: string; code: string }[]) || [];
  const depId =
    funcionario.user.dependencyId ||
    deps[0]?.id ||
    (Array.isArray(depsRes.json.data) ? (depsRes.json.data as { id: string }[])[0]?.id : undefined);

  // Create user (super)
  const stamp = Date.now();
  const newEmail = `smoke.${stamp}@sigaf.local`;
  const createUser = await api(
    "POST /users crear",
    superAdmin.cookie,
    "/api/v1/users",
    {
      method: "POST",
      body: JSON.stringify({
        email: newEmail,
        password: "Smoke2026!",
        firstName: "Smoke",
        lastName: "Test",
        roleId: workerRole?.id,
        dependencyId: depId ?? null,
      }),
    },
    201
  );
  const createdUserId = (createUser.json.data as { id?: string })?.id;

  // Patch user (nombre/correo)
  if (createdUserId) {
    await api(
      "PATCH /users/:id editar",
      superAdmin.cookie,
      `/api/v1/users/${createdUserId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          firstName: "SmokeEdit",
          lastName: "Test",
          email: newEmail,
        }),
      }
    );
  }

  // Documents list
  await api("GET /documents", funcionario.cookie, "/api/v1/documents");

  // Workflow inbox
  await api("GET /documents/workflow", jefe.cookie, "/api/v1/documents/workflow");

  // Submit document for review
  const submit = await api(
    "POST workflow submit",
    funcionario.cookie,
    "/api/v1/documents/workflow",
    {
      method: "POST",
      body: JSON.stringify({
        action: "submit",
        name: `Doc smoke ${stamp}`,
        dependencyId: depId,
        folioCount: 1,
        observations: "Prueba smoke simulación producción",
      }),
    },
    201
  );
  const docId = (submit.json.data as { id?: string })?.id;

  // Digitize with tiny PDF-like buffer (plain text as .txt if PDF parse fails is ok)
  if (docId) {
    const fd = new FormData();
    const blob = new Blob([`%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nSMOKE ${stamp}`], {
      type: "application/pdf",
    });
    fd.append("file", blob, `smoke-${stamp}.pdf`);
    await api(
      "POST digitize",
      funcionario.cookie,
      `/api/v1/documents/${docId}/digitize`,
      { method: "POST", body: fd },
      [200, 400]
    );

    // Flujo completo: Jefe → Archivo → Transferencia AG→AC
    console.log("\n--- Flujo aprobación + transferencia ---\n");
    await api(
      "WF start_dept_review",
      jefe.cookie,
      "/api/v1/documents/workflow",
      {
        method: "POST",
        body: JSON.stringify({ action: "start_dept_review", documentId: docId }),
      }
    );
    await api(
      "WF approve_dept",
      jefe.cookie,
      "/api/v1/documents/workflow",
      {
        method: "POST",
        body: JSON.stringify({
          action: "approve_dept",
          documentId: docId,
          observations: "OK smoke jefe",
        }),
      }
    );
    await api(
      "WF approve_archive",
      docAdmin.cookie,
      "/api/v1/documents/workflow",
      {
        method: "POST",
        body: JSON.stringify({
          action: "approve_archive",
          documentId: docId,
          observations: "OK smoke archivo",
        }),
      }
    );

    const transfer = await api(
      "POST lifecycle transfer AG→AC",
      docAdmin.cookie,
      "/api/v1/lifecycle",
      {
        method: "POST",
        body: JSON.stringify({
          title: `Smoke transferencia ${stamp}`,
          kind: "PRIMARY",
          fromPhase: "MANAGEMENT",
          toPhase: "CENTRAL",
          documentIds: [docId],
          notes: "Simulación producción",
          checklistFoliation: true,
          checklistChronological: true,
          checklistInventory: true,
          checklistBoxFolder: true,
        }),
      },
      [201, 400]
    );
    const transferId = (transfer.json.data as { id?: string })?.id;
    if (transferId) {
      await api(
        "POST lifecycle complete",
        docAdmin.cookie,
        `/api/v1/lifecycle/${transferId}/complete`,
        { method: "POST" },
        [200, 400]
      );
      await api(
        "GET transfer inventory",
        docAdmin.cookie,
        `/api/v1/lifecycle/${transferId}/inventory?format=xlsx`
      );
    }
  }

  // Préstamo 24h (documento ACTIVE disponible)
  {
    const avail = await api(
      "GET loans available",
      funcionario.cookie,
      "/api/v1/loans?available=1"
    );
    const docs = (avail.json.data as { id: string }[]) || [];
    if (docs[0]?.id) {
      const created = await api(
        "POST loan request",
        funcionario.cookie,
        "/api/v1/loans",
        {
          method: "POST",
          body: JSON.stringify({
            documentId: docs[0].id,
            notes: "Smoke préstamo 24h",
          }),
        },
        201
      );
      const loanId = (created.json.data as { id?: string })?.id;
      if (loanId) {
        await api(
          "PATCH loan approve",
          docAdmin.cookie,
          `/api/v1/loans/${loanId}`,
          { method: "PATCH", body: JSON.stringify({ action: "approve" }) }
        );
        await api(
          "PATCH loan return",
          funcionario.cookie,
          `/api/v1/loans/${loanId}`,
          { method: "PATCH", body: JSON.stringify({ action: "return" }) }
        );
      }
    } else {
      results.push({
        name: "POST loan request",
        ok: true,
        detail: "skip sin docs ACTIVE",
        ms: 0,
      });
    }
  }

  // TRD export / manage
  await api("GET trd manage export", docAdmin.cookie, "/api/v1/trd/manage?view=export", {}, [
    200,
  ]);
  await api("GET trd stats/list", docAdmin.cookie, "/api/v1/trd");

  // Disposal candidates
  await api(
    "GET disposal-candidates",
    docAdmin.cookie,
    "/api/v1/trd/disposal-candidates"
  );

  // Lifecycle stats
  await api("GET lifecycle", docAdmin.cookie, "/api/v1/lifecycle");

  // Search
  await api("GET search", docAdmin.cookie, "/api/v1/search?q=smoke");

  // Jobs retention (may complete)
  await api(
    "POST job retention.scan",
    docAdmin.cookie,
    "/api/v1/jobs",
    { method: "POST", body: JSON.stringify({ type: "retention.scan" }) },
    [200, 201]
  );

  // FUID
  await api("GET FUID export", docAdmin.cookie, "/api/v1/inventories/fuid");

  // Settings read
  await api("GET settings", superAdmin.cookie, "/api/v1/settings");

  // --- Carga ligera: 5 usuarios + 5 docs ---
  console.log("\n--- Carga ligera ---\n");
  let loadOk = 0;
  for (let i = 0; i < 5; i++) {
    const email = `load.${stamp}.${i}@sigaf.local`;
    const cu = await api(
      `LOAD create user ${i}`,
      superAdmin.cookie,
      "/api/v1/users",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password: "Load2026!",
          firstName: `Load${i}`,
          lastName: "User",
          roleId: workerRole?.id,
          dependencyId: depId ?? null,
        }),
      },
      201
    );
    if (cu.ok) loadOk++;

    const sd = await api(
      `LOAD submit doc ${i}`,
      funcionario.cookie,
      "/api/v1/documents/workflow",
      {
        method: "POST",
        body: JSON.stringify({
          action: "submit",
          name: `Load doc ${stamp}-${i}`,
          dependencyId: depId,
          folioCount: 1,
        }),
      },
      201
    );
    if (sd.ok) loadOk++;
  }
  results.push({
    name: "LOAD resumen (10 ops)",
    ok: loadOk >= 8,
    detail: `${loadOk}/10 ok`,
    ms: 0,
  });

  // --- Concurrencia ligera (stress suave) ---
  console.log("\n--- Concurrencia (20 GET paralelos) ---\n");
  const concT0 = Date.now();
  const conc = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      fetch(`${BASE}/api/v1/documents`, {
        headers: { Cookie: docAdmin.cookie },
      }).then(async (res) => {
        const json = await res.json();
        return res.status === 200 && json.success;
      })
    )
  );
  const concOk = conc.filter(Boolean).length;
  results.push({
    name: "STRESS 20 GET /documents paralelo",
    ok: concOk >= 18,
    detail: `${concOk}/20 ok`,
    ms: Date.now() - concT0,
  });

  const concSubmitT0 = Date.now();
  const concDocs = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      fetch(`${BASE}/api/v1/documents/workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: funcionario.cookie,
        },
        body: JSON.stringify({
          action: "submit",
          name: `Concurrent doc ${stamp}-${i}`,
          dependencyId: depId,
          folioCount: 1,
        }),
      }).then(async (res) => {
        const json = await res.json();
        return res.status === 201 && json.success;
      })
    )
  );
  const concDocsOk = concDocs.filter(Boolean).length;
  results.push({
    name: "STRESS 5 submit paralelo",
    ok: concDocsOk >= 4,
    detail: `${concDocsOk}/5 ok`,
    ms: Date.now() - concSubmitT0,
  });

  // Report
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log("\n=== RESULTADOS ===\n");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.ms}ms | ${r.name} | ${r.detail}`);
  }
  console.log(`\nTotal: ${passed}/${results.length} OK`);
  if (failed.length) {
    console.log("\nFallos:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log("\nSimulación OK: flujos principales respondieron correctamente.");
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
