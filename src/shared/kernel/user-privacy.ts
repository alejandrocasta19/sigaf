/** Campos sensibles que nunca deben salir en JSON de API/UI. */
export const USER_SECRET_OMIT = {
  passwordHash: true,
  mfaSecret: true,
} as const;

/** Select mínimo seguro para relaciones User anidadas. */
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  roleId: true,
  dependencyId: true,
  organizationId: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;
