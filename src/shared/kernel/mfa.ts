/**
 * MFA TOTP helpers (otplib v13+).
 */
import { generateSecret, generateURI, verifySync } from "otplib";

export function generateMfaSecret() {
  return generateSecret();
}

export function mfaOtpauthUrl(params: { email: string; secret: string; issuer?: string }) {
  return generateURI({
    issuer: params.issuer || "SIGAF",
    label: params.email,
    secret: params.secret,
  });
}

export function verifyMfaToken(secret: string, token: string) {
  const result = verifySync({
    secret,
    token: token.replace(/\s/g, ""),
    // ±1 período TOTP (30s)
    epochTolerance: 30,
  });
  return result.valid;
}
