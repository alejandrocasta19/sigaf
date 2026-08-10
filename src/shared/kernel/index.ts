/** Kernel compartido — no depende de módulos de dominio */
export { prisma } from "./prisma";
export { getSession, signToken, verifyToken, hasPermission, canAccessDependency } from "./auth";
export {
  AppError,
  jsonOk,
  jsonError,
  writeAudit,
  encodeCursor,
  decodeCursor,
} from "./http";
export type { SessionUser } from "./types";
export { ROLE_THEME, AUTH_COOKIE, CSRF_COOKIE } from "./types";
export { cn, formatNumber, formatDate } from "./utils";
export { getNavForRole, NAV_BY_ROLE } from "./navigation";
export {
  saveUpload,
  readUpload,
  resolveUploadPath,
  hashBuffer,
  ensureUploadDir,
} from "./storage";
