/** Solo runtime Node. Sin imports de Node modules (Edge Instrumentation). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const errors: string[] = [];
  const jwt = process.env.JWT_SECRET || "";
  if (jwt.length < 32) {
    errors.push("JWT_SECRET debe tener al menos 32 caracteres en producción");
  }
  if (/change-me|sigaf-dev|secret/i.test(jwt) && jwt.length < 48) {
    errors.push("JWT_SECRET parece un valor de ejemplo; genere uno fuerte");
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
