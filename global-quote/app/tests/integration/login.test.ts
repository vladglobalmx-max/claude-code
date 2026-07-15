import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma/client";
import { MAX_FAILED_LOGIN_ATTEMPTS, verifyCredentials } from "@/lib/auth/verify-credentials";
import type { RoleCode } from "@/generated/prisma/enums";

const DEMO_PASSWORD = "GlobalQuote2026!";

const SEEDED_USERS: { email: string; role: RoleCode }[] = [
  { email: "ana.torres@globalsuppliermty.com", role: "SUPER_ADMIN" },
  { email: "direccion.general.demo@globalsuppliermty.com", role: "DIRECCION_GENERAL" },
  { email: "laura.gonzalez@globalsuppliermty.com", role: "ADMINISTRACION" },
  { email: "carlos.medina@globalsuppliermty.com", role: "GERENTE_VENTAS" },
  { email: "diego.ramirez@globalsuppliermty.com", role: "VENDEDOR" },
  { email: "sofia.hernandez@globalsuppliermty.com", role: "MARKETING" },
  { email: "consulta.demo@globalsuppliermty.com", role: "CONSULTA" },
];

describe("verifyCredentials against the seeded database", () => {
  it.each(SEEDED_USERS)(
    "logs in $email with the demo password and resolves role $role",
    async ({ email, role }) => {
      const result = await verifyCredentials(email, DEMO_PASSWORD);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.role).toBe(role);
        expect(result.user.email).toBe(email);
      }
    },
  );

  it("rejects a wrong password without revealing whether the account exists", async () => {
    const result = await verifyCredentials("ana.torres@globalsuppliermty.com", "not-the-password");
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("rejects an email that does not exist", async () => {
    const result = await verifyCredentials("nadie@globalsuppliermty.com", DEMO_PASSWORD);
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });
});

describe("account lockout after failed attempts (docs/ARCHITECTURE.md §4.3)", () => {
  const email = "lockout-test@globalsuppliermty.com";
  let roleId: string;

  beforeAll(async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "VENDEDOR" } });
    roleId = role.id;
    await prisma.user.upsert({
      where: { email },
      update: { failedLoginAttempts: 0, lockedUntil: null },
      create: {
        email,
        fullName: "Usuario de prueba de bloqueo",
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
        roleId,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { email } });
  });

  it("locks the account after 5 consecutive failed attempts and blocks the correct password too", async () => {
    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      const result = await verifyCredentials(email, "wrong-password");
      expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
    }

    const lockedResult = await verifyCredentials(email, DEMO_PASSWORD);
    expect(lockedResult).toEqual({ ok: false, reason: "account_locked" });
  });
});

describe("inactive account cannot log in", () => {
  const email = "inactive-test@globalsuppliermty.com";

  beforeAll(async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "VENDEDOR" } });
    await prisma.user.upsert({
      where: { email },
      update: { active: false },
      create: {
        email,
        fullName: "Usuario inactivo de prueba",
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
        roleId: role.id,
        active: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { email } });
  });

  it("rejects login with account_inactive", async () => {
    const result = await verifyCredentials(email, DEMO_PASSWORD);
    expect(result).toEqual({ ok: false, reason: "account_inactive" });
  });
});
