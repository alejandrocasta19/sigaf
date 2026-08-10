import { AppError } from "@/shared/kernel/http";

export type PasswordPolicy = {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
};

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSpecial: true,
};

export function assertPasswordPolicy(
  password: string,
  policy: Partial<PasswordPolicy> = {}
) {
  const p = { ...DEFAULT_PASSWORD_POLICY, ...policy };
  if (password.length < p.minLength) {
    throw new AppError(`La contraseña debe tener al menos ${p.minLength} caracteres`, 400);
  }
  if (p.requireUpper && !/[A-ZÁÉÍÓÚÑ]/.test(password)) {
    throw new AppError("La contraseña debe incluir al menos una mayúscula", 400);
  }
  if (p.requireLower && !/[a-záéíóúñ]/.test(password)) {
    throw new AppError("La contraseña debe incluir al menos una minúscula", 400);
  }
  if (p.requireDigit && !/\d/.test(password)) {
    throw new AppError("La contraseña debe incluir al menos un número", 400);
  }
  if (p.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    throw new AppError("La contraseña debe incluir al menos un carácter especial", 400);
  }
}
