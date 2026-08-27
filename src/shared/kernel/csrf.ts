export const CSRF_COOKIE = "sigaf_csrf";
export const CSRF_HEADER = "X-CSRF-Token";

const TOKEN_BYTES = 32;

/** Genera token CSRF (Edge-safe, Web Crypto). */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function csrfCookieOptions(maxAge = 60 * 60 * 8) {
  return {
    httpOnly: false as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export function readCsrfFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/** Double-submit: cookie === header y longitud mínima. */
export function validateCsrfDoubleSubmit(cookieValue: string | null | undefined, headerValue: string | null): boolean {
  if (!cookieValue || !headerValue) return false;
  if (cookieValue.length < TOKEN_BYTES * 2) return false;
  return cookieValue === headerValue;
}

/** Rutas mutantes públicas (sin sesión previa). */
export const CSRF_EXEMPT_PREFIXES = [
  "/api/auth/login",
  "/api/auth/mfa",
  "/api/health",
  "/api/v1/uploads/stream",
  "/api/internal/rate-limit",
];

export function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
