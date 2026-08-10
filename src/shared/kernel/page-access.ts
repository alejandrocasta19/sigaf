import { redirect } from "next/navigation";
import { hasPermission } from "@/shared/kernel/permissions";
import type { SessionUser } from "@/shared/kernel/types";
import type { RoleCode } from "@prisma/client";

/**
 * Gate de páginas del dashboard.
 * - Si `roles` está definido: el rol debe coincidir (SUPER_ADMIN siempre pasa salvo allowSuper=false).
 * - Si solo `permission`: se exige el permiso.
 * - Si ambos: se exigen **ambos** (AND). Preferir solo `roles` en pantallas admin.
 */
export function requirePageAccess(
  user: SessionUser | null,
  opts: {
    permission?: string;
    roles?: RoleCode[];
    allowSuper?: boolean;
  } = {}
): SessionUser {
  if (!user) redirect("/login");

  const allowSuper = opts.allowSuper !== false;
  if (allowSuper && user.roleCode === "SUPER_ADMIN") return user;

  const roleOk = !opts.roles?.length || opts.roles.includes(user.roleCode);
  const permOk = !opts.permission || hasPermission(user, opts.permission);

  if (!roleOk || !permOk) redirect("/dashboard");

  return user;
}
