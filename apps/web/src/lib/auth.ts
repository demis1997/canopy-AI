import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@canopy/database";
import { loginSchema, type Role } from "@canopy/shared";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      organizationId: string | null;
      role: Role;
      isPlatformAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId: string | null;
    role: Role;
    isPlatformAdmin: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { memberships: true },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        const membership = user.memberships[0];
        const role: Role = user.isPlatformAdmin
          ? "PLATFORM_ADMIN"
          : (membership?.role ?? "CHATTER");
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            organizationId: membership?.organizationId,
            action: "LOGIN",
            entityType: "User",
            entityId: user.id,
          },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: membership?.organizationId ?? null,
          role,
          isPlatformAdmin: user.isPlatformAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.organizationId = (user as { organizationId: string | null }).organizationId;
        token.role = (user as { role: Role }).role;
        token.isPlatformAdmin = (user as { isPlatformAdmin: boolean }).isPlatformAdmin;
      }
      if (token.sub && process.env.NEXT_RUNTIME !== "edge") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: { memberships: true },
        });
        if (dbUser) {
          const membership = dbUser.memberships[0];
          token.organizationId = membership?.organizationId ?? null;
          token.isPlatformAdmin = dbUser.isPlatformAdmin;
          token.role = dbUser.isPlatformAdmin
            ? "PLATFORM_ADMIN"
            : (membership?.role ?? "CHATTER");
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.organizationId = token.organizationId;
      session.user.role = token.role;
      session.user.isPlatformAdmin = token.isPlatformAdmin;
      return session;
    },
  },
});
