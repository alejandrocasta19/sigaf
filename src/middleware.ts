 import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { AUTH_COOKIE, CSRF_COOKIE, type SessionUser } from "@/shared/kernel/types";
import {
  CSRF_HEADER,
  csrfCookieOptions,
  generateCsrfToken,
  isCsrfExempt,
  validateCsrfDoubleSubmit,
} from "@/shared/kernel/csrf";
import {
  adminMustEnrollMfa,
  isMfaSetupPath,
} from "@/shared/kernel/production-policy";
import { applySecurityHeaders, isPublicStaticAsset } from "@/shared/kernel/security-headers";

const PUBLIC = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/mfa",
  "/api/health",
  "/api/v1/uploads/stream",
  "/api/internal/rate-limit",
];

const apiHits = new Map<string, { count: number; resetAt: number }>();

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error("JWT_SECRET must be configured");
  }
  return new TextEncoder().encode(value);
}

type JwtPayload = {
  sessionId?: unknown;
  roleCode?: unknown;
  mfaEnabled?: unknown;
};

async function readJwtPayload(token: string | undefined): Promise<JwtPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

function clearAuth(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  res.cookies.set(CSRF_COOKIE, "", {
    httpOnly: false,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

function ensureCsrfCookie(res: NextResponse) {
  const existing = res.cookies.get(CSRF_COOKIE)?.value;
  if (!existing || existing.length < 32) {
    res.cookies.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieOptions());
  }
  return res;
}

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

/** Rate limit global API (por IP). Con Redis es compartido entre réplicas. */
function allowApiRequestMemory(ip: string) {
  const max =
    Number(process.env.API_RATE_MAX) ||
    (process.env.NODE_ENV === "production" ? 120 : 2000);
  const now = Date.now();
  const entry = apiHits.get(ip);
  if (!entry || entry.resetAt < now) {
    apiHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

async function allowApiRequest(request: NextRequest, ip: string) {
  const max =
    Number(process.env.API_RATE_MAX) ||
    (process.env.NODE_ENV === "production" ? 120 : 2000);
  if (process.env.REDIS_URL && process.env.CSRF_SECRET) {
    try {
      const url = new URL("/api/internal/rate-limit", request.nextUrl.origin);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-rl-secret": process.env.CSRF_SECRET,
          "x-rl-ip": ip,
          "x-rl-max": String(max),
          "x-rl-window": "60000",
        },
      });
      if (res.status === 429) return false;
      if (res.ok) return true;
    } catch {
      /* fallback memoria */
    }
  }
  return allowApiRequestMemory(ip);
}

function assertApiCsrf(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const { pathname } = request.nextUrl;
  if (isCsrfExempt(pathname)) return true;

  const cookie = request.cookies.get(CSRF_COOKIE)?.value;
  const header = request.headers.get(CSRF_HEADER);
  if (validateCsrfDoubleSubmit(cookie, header)) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return process.env.NODE_ENV !== "production";
}

function forceHttps(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (process.env.FORCE_HTTPS === "false" || process.env.ALLOW_HTTP === "true") return null;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (request.nextUrl.protocol === "https:" ? "https" : "http");
  if (proto === "https") return null;
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  return NextResponse.redirect(url, 308);
}

function finish(
  res: NextResponse,
  requestId: string,
  opts?: { csrf?: boolean; hsts?: boolean }
) {
  res.headers.set("x-request-id", requestId);
  let out = applySecurityHeaders(res, { hsts: opts?.hsts ?? process.env.NODE_ENV === "production" });
  if (opts?.csrf) out = ensureCsrfCookie(out);
  return out;
}

export async function middleware(request: NextRequest) {
  const hsts = process.env.NODE_ENV === "production";
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const httpsRedirect = forceHttps(request);
  if (httpsRedirect) return finish(httpsRedirect, requestId, { hsts: true });

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || isPublicStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/") &&
    pathname !== "/api/health" &&
    pathname !== "/api/internal/rate-limit"
  ) {
    if (!(await allowApiRequest(request, clientIp(request)))) {
      return finish(
        NextResponse.json(
          { success: false, error: "Demasiadas solicitudes. Intente más tarde." },
          { status: 429 }
        ),
        requestId,
        { hsts }
      );
    }
  }

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const jwt = await readJwtPayload(token);
  const loggedIn = typeof jwt?.sessionId === "string" && jwt.sessionId.length > 0;

  if (token && !loggedIn) {
    if (
      pathname === "/login" ||
      pathname === "/api/auth/login" ||
      pathname === "/api/auth/mfa" ||
      pathname === "/api/health"
    ) {
      return finish(clearAuth(NextResponse.next({ request: { headers: requestHeaders } })), requestId, {
        csrf: pathname === "/login",
        hsts,
      });
    }
    if (pathname.startsWith("/api/")) {
      return finish(
        clearAuth(NextResponse.json({ success: false, error: "Sesión inválida" }, { status: 401 })),
        requestId,
        { hsts }
      );
    }
    return finish(clearAuth(NextResponse.redirect(new URL("/login", request.url))), requestId, { hsts });
  }

  if (pathname === "/") {
    return finish(
      NextResponse.redirect(new URL(loggedIn ? "/dashboard" : "/login", request.url)),
      requestId,
      { csrf: !loggedIn, hsts }
    );
  }

  if (isPublic) {
    if (loggedIn && pathname === "/login") {
      return finish(NextResponse.redirect(new URL("/dashboard", request.url)), requestId, { hsts });
    }
    return finish(
      NextResponse.next({ request: { headers: requestHeaders } }),
      requestId,
      { csrf: pathname === "/login", hsts }
    );
  }

  if (pathname.startsWith("/api/") && !assertApiCsrf(request)) {
    return finish(
      NextResponse.json({ success: false, error: "Token CSRF inválido u origen no permitido" }, { status: 403 }),
      requestId,
      { hsts }
    );
  }

  if (!loggedIn) {
    if (pathname.startsWith("/api/")) {
      return finish(
        NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 }),
        requestId,
        { hsts }
      );
    }
    return finish(NextResponse.redirect(new URL("/login", request.url)), requestId, { csrf: true, hsts });
  }

  if (
    adminMustEnrollMfa({
      roleCode: jwt?.roleCode as SessionUser["roleCode"],
      mfaEnabled: Boolean(jwt?.mfaEnabled),
    }) &&
    !isMfaSetupPath(pathname)
  ) {
    if (pathname.startsWith("/api/")) {
      return finish(
        NextResponse.json(
          {
            success: false,
            error: "MFA obligatorio para administradores. Configure en /settings/security",
            code: "MFA_REQUIRED",
          },
          { status: 403 }
        ),
        requestId,
        { hsts }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/settings/security";
    url.searchParams.set("mfa", "required");
    return finish(NextResponse.redirect(url), requestId, { hsts });
  }

  return finish(NextResponse.next({ request: { headers: requestHeaders } }), requestId, {
    csrf: true,
    hsts,
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
