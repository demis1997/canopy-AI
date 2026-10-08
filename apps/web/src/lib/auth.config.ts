import type { NextAuthConfig } from "next-auth";

const secure = process.env.NODE_ENV === "production";
export const sessionCookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [],
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
      },
    },
  },
} satisfies NextAuthConfig;
