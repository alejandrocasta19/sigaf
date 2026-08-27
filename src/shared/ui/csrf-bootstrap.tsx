"use client";

import { useEffect } from "react";
import { CSRF_COOKIE, CSRF_HEADER } from "@/shared/kernel/csrf";

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== "string" && !(input instanceof URL) && input.method) {
    return input.method.toUpperCase();
  }
  return "GET";
}

/**
 * Parchea fetch para enviar X-CSRF-Token en mutaciones /api/* (double-submit cookie).
 */
export function CsrfBootstrap() {
  useEffect(() => {
    const original = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = resolveUrl(input);
      const method = resolveMethod(input, init);
      const isApi = url.startsWith("/api/") || url.includes("/api/");

      if (isApi) {
        const headers = new Headers(
          init?.headers ??
            (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined)
        );
        if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
          const csrf = readCsrfCookie();
          if (csrf) headers.set(CSRF_HEADER, csrf);
        }
        return original(input, {
          ...init,
          headers,
          credentials: init?.credentials ?? "include",
        });
      }

      return original(input, init);
    };

    return () => {
      window.fetch = original;
    };
  }, []);

  return null;
}
