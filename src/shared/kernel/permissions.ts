import type { SessionUser } from "./types";
import { AppError } from "./http";

export function hasPermission(user: SessionUser, code: string) {
  if (user.roleCode === "SUPER_ADMIN") return true;
  return user.permissions.includes(code) || user.permissions.includes("*");
}

export function requirePermission(user: SessionUser, code: string) {
  if (!hasPermission(user, code)) {
    throw new AppError(`Sin permiso: ${code}`, 403);
  }
}

export function requireAnyPermission(user: SessionUser, codes: string[]) {
  if (user.roleCode === "SUPER_ADMIN") return;
  if (codes.some((c) => hasPermission(user, c))) return;
  throw new AppError(`Sin permiso: se requiere uno de ${codes.join(", ")}`, 403);
}
