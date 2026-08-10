/**
 * Stress ligero concurrente contra SIGAF.
 * Uso: npx tsx scripts/stress-load.ts
 * Env: STRESS_GETS=50 STRESS_SUBMITTERS=10 APP_URL=http://localhost:3000
 */
const BASE = process.env.APP_URL || "http://localhost:3000";
const PASS = "Sigaf2026!";
const GETS = Number(process.env.STRESS_GETS || 50);
const SUBMITS = Number(process.env.STRESS_SUBMITS || 10);

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

async function login(email: string, fwd = `stress-${email}`) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": fwd,
    },
    body: JSON.stringify({ email, password: PASS }),
  });
  const json = await res.json();
  const cookie = cookieFrom(res);
  if (!cookie) throw new Error(`Login fail ${email}: ${res.status} ${json.error || ""}`);
  return { cookie, user: json.data.user as { dependencyId: string | null } };
}

async function main() {
  console.log(`\n=== STRESS SIGAF @ ${BASE} (GETS=${GETS}, SUBMITS=${SUBMITS}) ===\n`);
  const docAdmin = await login("documental@sigaf.local");
  const funcionario = await login("funcionario@sigaf.local");
  const depId = funcionario.user.dependencyId;

  const tGet = Date.now();
  const getResults = await Promise.all(
    Array.from({ length: GETS }, () =>
      fetch(`${BASE}/api/v1/documents`, { headers: { Cookie: docAdmin.cookie } }).then(
        async (r) => {
          const j = await r.json();
          return { ok: r.status === 200 && j.success, ms: 0 };
        }
      )
    )
  );
  const getOk = getResults.filter((r) => r.ok).length;
  const getMs = Date.now() - tGet;
  console.log(`GET /documents paralelo: ${getOk}/${GETS} OK en ${getMs}ms (avg ~${Math.round(getMs / GETS)}ms)`);

  const tSub = Date.now();
  const stamp = Date.now();
  const subResults = await Promise.all(
    Array.from({ length: SUBMITS }, (_, i) =>
      fetch(`${BASE}/api/v1/documents/workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: funcionario.cookie,
        },
        body: JSON.stringify({
          action: "submit",
          name: `Stress ${stamp}-${i}`,
          dependencyId: depId,
          folioCount: 1,
        }),
      }).then(async (r) => {
        const j = await r.json();
        return r.status === 201 && j.success;
      })
    )
  );
  const subOk = subResults.filter(Boolean).length;
  const subMs = Date.now() - tSub;
  console.log(
    `POST workflow submit paralelo: ${subOk}/${SUBMITS} OK en ${subMs}ms (avg ~${Math.round(subMs / SUBMITS)}ms)`
  );

  // Mix: login bursts
  const tLogin = Date.now();
  const loginBurst = await Promise.all(
    Array.from({ length: 15 }, (_, i) =>
      login(
        i % 2 === 0 ? "consulta@sigaf.local" : "jefe@sigaf.local",
        `stress-burst-${i}`
      )
        .then(() => true)
        .catch(() => false)
    )
  );
  const loginOk = loginBurst.filter(Boolean).length;
  console.log(`Login burst 15: ${loginOk}/15 OK en ${Date.now() - tLogin}ms`);

  const pass = getOk >= GETS * 0.9 && subOk >= SUBMITS * 0.8 && loginOk >= 12;
  console.log(pass ? "\nSTRESS OK\n" : "\nSTRESS CON FALLAS\n");
  if (!pass) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
