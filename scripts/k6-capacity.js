/**
 * Esqueleto k6 — rampa 10 → 50 → 100 → 250 → 500 VUs.
 * No ejecutar 500 VUs reales en este sprint; usarlo en el servidor de pruebas.
 *
 *   k6 run -e BASE_URL=http://localhost:3000 -e EMAIL=documental@sigaf.local -e PASSWORD=*** scripts/k6-capacity.js
 *
 * Escenario mixto aproximado a 500 usuarios:
 *  100 consultando / 50 subiendo (intent, no el PDF por Next) / 30 buscando /
 *  20 reportes async / resto otras lecturas.
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 10 },
        { duration: "2m", target: 50 },
        { duration: "2m", target: 100 },
        { duration: "3m", target: 250 },
        { duration: "3m", target: 500 },
        { duration: "2m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const jar = http.cookieJar();
  const login = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: __ENV.EMAIL, password: __ENV.PASSWORD }),
    { headers: { "Content-Type": "application/json" }, jar }
  );
  check(login, { "login 200": (r) => r.status === 200 });

  const roll = Math.random();
  if (roll < 0.2) {
    http.get(`${BASE}/dashboard`, { jar });
  } else if (roll < 0.26) {
    http.get(`${BASE}/api/v1/expedientes`, { jar });
  } else if (roll < 0.32) {
    http.get(`${BASE}/api/v1/documents?q=contrato`, { jar });
  } else if (roll < 0.36) {
    http.get(`${BASE}/api/v1/reports?type=expedientes&format=csv`, { jar });
  } else {
    http.get(`${BASE}/api/v1/expedientes`, { jar });
  }
  sleep(1);
}
