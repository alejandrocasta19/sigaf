/**
 * Auditoría interna de seguridad (sustituto parcial de pentest).
 * No reemplaza una auditoría externa contratada.
 *
 * Uso: npx tsx scripts/security-audit.ts
 * Requiere servidor en APP_URL (default http://localhost:3000)
 */
const BASE = process.env.APP_URL || "http://localhost:3000";
const PASS = "Sigaf2026!";

type Row = { name: string; ok: boolean; detail: string };
const rows: Row[] = [];

function record(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${detail}`);
}

function cookieFrom(res: Response) {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    const token = anyHeaders.getSetCookie().find((c) => c.startsWith("sigaf_token="));
    if (token) return token.split(";")[0];
  }
  const raw = res.headers.get("set-cookie");
  const m = raw?.match(/sigaf_token=[^;]+/);
  return m ? m[0] : null;
}

async function login(email: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `audit-${email}` },
    body: JSON.stringify({ email, password: PASS }),
  });
  const json = await res.json();
  return { res, json, cookie: cookieFrom(res) };
}

async function main() {
  console.log(`\n=== SIGAF security-audit @ ${BASE} ===\n`);

  const health = await fetch(`${BASE}/api/health`);
  record("HEALTH", health.status === 200, String(health.status));

  const bad = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "audit-bad" },
    body: JSON.stringify({ email: "super@sigaf.local", password: "wrong-password" }),
  });
  record("NEG login malo → 401", bad.status === 401, String(bad.status));

  const consulta = await login("consulta@sigaf.local");
  record("LOGIN consulta", !!consulta.cookie, consulta.json?.data?.user?.roleCode || "fail");

  if (consulta.cookie) {
    const createUser = await fetch(`${BASE}/api/v1/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: consulta.cookie,
      },
      body: JSON.stringify({
        email: "hack@x.local",
        password: "Hack2026!!",
        firstName: "H",
        lastName: "X",
        roleId: "x",
      }),
    });
    record(
      "NEG consulta crea usuario",
      createUser.status === 403 || createUser.status === 401,
      String(createUser.status)
    );

    const jobs = await fetch(`${BASE}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: consulta.cookie },
      body: JSON.stringify({ type: "system.backup" }),
    });
    record(
      "NEG consulta lanza backup",
      jobs.status === 403 || jobs.status === 401,
      String(jobs.status)
    );
  }

  const weak = await login("super@sigaf.local");
  if (weak.cookie) {
    const weakPass = await fetch(`${BASE}/api/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: weak.cookie },
      body: JSON.stringify({
        email: `weak.${Date.now()}@sigaf.local`,
        password: "123456",
        firstName: "W",
        lastName: "P",
        roleId: "x",
      }),
    });
    record(
      "NEG password débil rechazada",
      weakPass.status === 400 || weakPass.status === 403,
      String(weakPass.status)
    );
  }

  const headers = await fetch(`${BASE}/login`);
  record(
    "Header X-Frame-Options",
    headers.headers.get("x-frame-options")?.toUpperCase() === "DENY",
    headers.headers.get("x-frame-options") || "missing"
  );
  record(
    "Header X-Content-Type-Options",
    headers.headers.get("x-content-type-options") === "nosniff",
    headers.headers.get("x-content-type-options") || "missing"
  );

  const passed = rows.filter((r) => r.ok).length;
  console.log(`\n=== RESULTADO: ${passed}/${rows.length} ===\n`);
  console.log(
    "Nota: esto NO sustituye un pentest externo (OWASP/ZAP, firma contratada)."
  );
  if (passed < rows.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
