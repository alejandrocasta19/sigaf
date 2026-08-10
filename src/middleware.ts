import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { AUTH_COOKIE } from "@/shared/kernel/types";

const PUBLIC = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/mfa", "/api/health"];

const apiHits = new Map<string, { count: number; resetAt: number }>();

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error("JWT_SECRET must be configured");
  }
  return new TextEncoder().encode(value);
}

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

function clearAuth(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

async function hasUsableSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    const sessionId = (payload as { sessionId?: unknown }).sessionId;
    return typeof sessionId === "string" && sessionId.length > 0;
  } catch {
    return false;
  }
}

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

/** Rate limit global API (por IP). En prod: 120/min; en dev más holgado. */
function allowApiRequest(ip: string) {
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

function assertApiCsrf(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const host = request.headers.get("host");
  if (!host) return true;

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

export async function middleware(request: NextRequest) {
  const httpsRedirect = forceHttps(request);
  if (httpsRedirect) return withSecurityHeaders(httpsRedirect);

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && pathname !== "/api/health") {
    if (!allowApiRequest(clientIp(request))) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, error: "Demasiadas solicitudes. Intente más tarde." },
          { status: 429 }
        )
      );
    }
  }

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const loggedIn = await hasUsableSession(token);

  if (token && !loggedIn) {
    if (
      pathname === "/login" ||
      pathname === "/api/auth/login" ||
      pathname === "/api/auth/mfa" ||
      pathname === "/api/health"
    ) {
      return withSecurityHeaders(clearAuth(NextResponse.next()));
    }
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        clearAuth(
          NextResponse.json({ success: false, error: "Sesión inválida" }, { status: 401 })
        )
      );
    }
    return withSecurityHeaders(
      clearAuth(NextResponse.redirect(new URL("/login", request.url)))
    );
  }

  if (pathname === "/") {
    return withSecurityHeaders(
      NextResponse.redirect(new URL(loggedIn ? "/dashboard" : "/login", request.url))
    );
  }

  if (isPublic) {
    if (loggedIn && pathname === "/login") {
      return withSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api/") && !assertApiCsrf(request)) {
    return withSecurityHeaders(
      NextResponse.json({ success: false, error: "Origen no permitido" }, { status: 403 })
    );
  }

  if (!loggedIn) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 })
      );
    }
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
