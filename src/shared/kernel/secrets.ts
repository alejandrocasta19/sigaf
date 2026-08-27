import { createHash, randomBytes } from "node:crypto";

/** Valida secretos mínimos (uso en scripts / Node). */
export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;

  const errors: string[] = [];
  const jwt = process.env.JWT_SECRET || "";
  if (jwt.length < 32) {
    errors.push("JWT_SECRET debe tener al menos 32 caracteres en producción");
  }
  if (/change-me|sigaf-dev|secret/i.test(jwt) && jwt.length < 48) {
    errors.push("JWT_SECRET parece un valor de ejemplo; genere uno fuerte");
  }

  const csrf = process.env.CSRF_SECRET || "";
  if (csrf.length < 24) {
    errors.push("CSRF_SECRET debe tener al menos 24 caracteres en producción");
  }

  const db = process.env.DATABASE_URL || "";
  if (!db) errors.push("DATABASE_URL es obligatorio");
  if (/sigaf_secret|postgres:postgres/i.test(db)) {
    errors.push("DATABASE_URL usa una contraseña débil/demo; cámbiela antes de producción");
  }

  const appUrl = process.env.APP_URL || "";
  if (appUrl && appUrl.startsWith("http://") && process.env.ALLOW_HTTP !== "true") {
    errors.push("APP_URL debe ser https:// en producción (o ALLOW_HTTP=true solo en LAN)");
  }

  if (errors.length) {
    throw new Error(`Configuración insegura de producción:\n- ${errors.join("\n- ")}`);
  }
}

export function generateSecret(bytes = 48) {
  return randomBytes(bytes).toString("base64url");
}

export function fingerprintSecret(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
