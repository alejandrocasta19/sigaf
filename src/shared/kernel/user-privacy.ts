/** Select seguro de User para Prisma 5 (sin `omit`, no soportado sin preview). */
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  status: true,
  roleId: true,
  dependencyId: true,
  organizationId: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const USER_WITH_ROLE_DEP_SELECT = {
  ...USER_PUBLIC_SELECT,
  role: true,
  dependency: true,
} as const;

export const USER_PROFILE_SELECT = {
  ...USER_PUBLIC_SELECT,
  role: true,
  dependency: true,
  organization: true,
} as const;

/** @deprecated Preferir selects; se mantiene por compatibilidad de imports. */
export const USER_SECRET_OMIT = {
  passwordHash: true,
  mfaSecret: true,
} as const;
