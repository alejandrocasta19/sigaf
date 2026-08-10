import { RoleCode } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roleCode: RoleCode;
  roleName: string;
  accessLevel: number;
  organizationId: string;
  organizationName: string;
  dependencyId: string | null;
  dependencyName: string | null;
  permissions: string[];
  avatarUrl: string | null;
  /** Id de fila Session en BD — permite revocar JWT */
  sessionId?: string;
};

export const ROLE_THEME: Record<
  RoleCode,
  { sidebar: string; accent: string; accentHover: string; activeBg: string; label: string }
> = {
  SUPER_ADMIN: {
    sidebar: "bg-[#0f172a]",
    accent: "bg-blue-600",
    accentHover: "hover:bg-blue-700",
    activeBg: "bg-blue-600",
    label: "Super Administrador",
  },
  SYSTEM_ADMIN: {
    sidebar: "bg-[#0f172a]",
    accent: "bg-blue-600",
    accentHover: "hover:bg-blue-700",
    activeBg: "bg-blue-600",
    label: "Administrador del Sistema",
  },
  DOC_ADMIN: {
    sidebar: "bg-[#064e3b]",
    accent: "bg-emerald-600",
    accentHover: "hover:bg-emerald-700",
    activeBg: "bg-emerald-700",
    label: "Administrador de Gestión Documental",
  },
  DEPT_HEAD: {
    sidebar: "bg-[#1e3a5f]",
    accent: "bg-blue-600",
    accentHover: "hover:bg-blue-700",
    activeBg: "bg-blue-600",
    label: "Jefe de Dependencia",
  },
  DEPT_WORKER: {
    sidebar: "bg-[#1e3a5f]",
    accent: "bg-sky-600",
    accentHover: "hover:bg-sky-700",
    activeBg: "bg-sky-600",
    label: "Funcionario de Dependencia",
  },
  CONSULT_USER: {
    sidebar: "bg-[#1e293b]",
    accent: "bg-slate-600",
    accentHover: "hover:bg-slate-700",
    activeBg: "bg-blue-600",
    label: "Usuario de Consulta",
  },
};

export const AUTH_COOKIE = "sigaf_token";
export const CSRF_COOKIE = "sigaf_csrf";
