/**
 * Genera secretos fuertes para .env de producción.
 * Uso: npx tsx scripts/generate-secrets.ts
 */
import { generateSecret, fingerprintSecret } from "../src/shared/kernel/secrets";

const jwt = generateSecret(48);
const csrf = generateSecret(32);
const dbPass = generateSecret(24);

console.log(`# Generado ${new Date().toISOString()}`);
console.log(`JWT_SECRET="${jwt}"`);
console.log(`# fingerprint ${fingerprintSecret(jwt)}`);
console.log(`CSRF_SECRET="${csrf}"`);
console.log(`# Ejemplo DATABASE_URL (cambie host/db):`);
console.log(
  `DATABASE_URL="postgresql://sigaf:${dbPass}@db:5432/sigaf?schema=public"`
);
console.log(`APP_URL="https://sigaf.ejemplo.gov.co"`);
console.log(`FORCE_HTTPS="true"`);
console.log(`NODE_ENV="production"`);
console.log(`REQUIRE_ADMIN_MFA="true"`);
console.log(`# API_RATE_MAX=120`);
console.log(`# LOGIN_RATE_MAX=20`);
