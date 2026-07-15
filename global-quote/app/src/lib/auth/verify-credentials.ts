import "server-only";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma/client";
import type { RoleCode } from "@/generated/prisma/enums";

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
};

export type VerifyCredentialsResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; reason: "invalid_credentials" | "account_inactive" | "account_locked" };

/**
 * Verifica email+password contra la base de datos, aplicando bloqueo por intentos
 * fallidos (docs/ARCHITECTURE.md §4.3). Se usa desde el `authorize` de Auth.js
 * y directamente en pruebas de integracion, sin pasar por HTTP.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<VerifyCredentialsResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { role: true },
  });

  if (!user || user.deletedAt) {
    return { ok: false, reason: "invalid_credentials" };
  }

  if (!user.active) {
    return { ok: false, reason: "account_inactive" };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, reason: "account_locked" };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    const failedAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : failedAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : user.lockedUntil,
      },
    });

    return { ok: false, reason: "invalid_credentials" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
    },
  };
}
