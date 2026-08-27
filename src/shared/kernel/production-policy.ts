import type { SessionUser } from "./types";

export const ADMIN_ROLE_CODES = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DOC_ADMIN"] as const;

export function isAdminRoleCode(roleCode: string) {
  return (ADMIN_ROLE_CODES as readonly string[]).includes(roleCode);
}

/** MFA obligatorio para admins en producción (salvo REQUIRE_ADMIN_MFA=false). */
export function adminMfaRequiredInProduction() {
  return process.env.NODE_ENV === "production" && process.env.REQUIRE_ADMIN_MFA !== "false";
}

export function adminMustEnrollMfa(user: Pick<SessionUser, "roleCode"> & { mfaEnabled?: boolean }) {
  if (!adminMfaRequiredInProduction()) return false;
  if (!isAdminRoleCode(user.roleCode)) return false;
  return !user.mfaEnabled;
}

/** Rutas permitidas sin MFA activo (solo enrolamiento / salida). */
export const MFA_SETUP_PATH_PREFIXES = [
  "/settings/security",
  "/profile",
  "/api/v1/auth/mfa",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/change-password",
];

export function isMfaSetupPath(pathname: string) {
  return MFA_SETUP_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
