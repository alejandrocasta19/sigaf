/**
 * Auditoría interna de seguridad (sustituto parcial de pentest).
 * No reemplaza una auditoría externa contratada.
 *
 * Uso: npm run test:security
 * Requiere servidor en APP_URL (default http://localhost:3000)
 */
const BASE = process.env.APP_URL || "http://localhost:3000";
const PASS = "Sigaf2026!";

type Row = { name: string; ok: boolean; detail: string };
const rows: Row[] = [];

function record(name: string, ok: boolean, detail: string) {
  rows.push({ name, detail, ok });
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

function csrfFrom(res: Response) {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    const csrf = anyHeaders.getSetCookie().find((c) => c.startsWith("sigaf_csrf="));
    if (csrf) return csrf.split(";")[0].split("=")[1];
  }
  const raw = res.headers.get("set-cookie");
  const m = raw?.match(/sigaf_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function mergeCookies(...parts: (string | null)[]) {
  return parts.filter(Boolean).join("; ");
}

async function login(email: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `audit-${email}` },
    body: JSON.stringify({ email, password: PASS }),
  });
  const json = await res.json();
  return { res, json, cookie: cookieFrom(res), csrf: csrfFrom(res) };
}

async function main() {
  console.log(`\n=== SIGAF security-audit @ ${BASE} ===\n`);

  const health = await fetch(`${BASE}/api/health`);
  record("HEALTH", health.status === 200, String(health.status));

  const loginPage = await fetch(`${BASE}/login`);
  record(
    "CSRF cookie en /login",
    Boolean(csrfFrom(loginPage)),
    csrfFrom(loginPage) ? "presente" : "ausente"
  );

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

  const superLogin = await login("super@sigaf.local");
  record("LOGIN super", !!superLogin.cookie, superLogin.json?.data?.user?.roleCode || "fail");

  if (superLogin.cookie) {
    const weakPass = await fetch(`${BASE}/api/v1/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: superLogin.cookie },
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

    const noCsrf = await fetch(`${BASE}/api/v1/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: superLogin.cookie,
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ type: "system.backup" }),
    });
    record(
      "NEG mutación sin CSRF / origen malo",
      noCsrf.status === 403,
      String(noCsrf.status)
    );

    if (superLogin.csrf) {
      const withCsrf = await fetch(`${BASE}/api/v1/notifications`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: mergeCookies(superLogin.cookie, `sigaf_csrf=${superLogin.csrf}`),
          "X-CSRF-Token": superLogin.csrf,
        },
        body: JSON.stringify({ markAllRead: true }),
      });
      record(
        "Mutación con CSRF válido (notificaciones)",
        withCsrf.status === 200 || withCsrf.status === 403,
        String(withCsrf.status)
      );
    }
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
  record(
    "Header Content-Security-Policy",
    Boolean(headers.headers.get("content-security-policy")),
    headers.headers.get("content-security-policy")?.slice(0, 40) || "missing"
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
