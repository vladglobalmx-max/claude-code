import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { verifyCredentials } from "@/lib/auth/verify-credentials";
import { ROLE_PERMISSIONS, type PermissionCode } from "@/lib/auth/permissions";
import type { RoleCode } from "@/generated/prisma/enums";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      fullName: string;
      role: RoleCode;
      permissions: PermissionCode[];
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    fullName: string;
    role: RoleCode;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contrasena", type: "password" },
      },
      authorize: async (rawCredentials) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const result = await verifyCredentials(parsed.data.email, parsed.data.password);
        if (!result.ok) return null;

        return {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.fullName = (user as { fullName: string }).fullName;
        token.role = (user as { role: RoleCode }).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      session.user.id = token.id;
      session.user.fullName = token.fullName;
      session.user.role = token.role;
      session.user.permissions = ROLE_PERMISSIONS[token.role] ?? [];
      return session;
    },
  },
});
