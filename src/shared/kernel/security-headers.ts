import type { NextResponse } from "next/server";

export function applySecurityHeaders(res: NextResponse, opts?: { hsts?: boolean }) {
  const storageOrigin = process.env.S3_PUBLIC_URL || "";
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob:${storageOrigin ? ` ${storageOrigin}` : ""}`,
      "font-src 'self' data:",
      `connect-src 'self'${storageOrigin ? ` ${storageOrigin}` : ""}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  if (opts?.hsts) {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  return res;
}

/** Solo assets estáticos públicos — no usar includes(".") genérico. */
export const PUBLIC_STATIC_FILE = /\.(ico|png|jpe?g|gif|webp|svg|css|js|mjs|map|woff2?|ttf|txt)$/i;

export function isPublicStaticAsset(pathname: string) {
  return PUBLIC_STATIC_FILE.test(pathname);
}
