import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "./db";

// Short-lived cache of account status for the session re-check below.
const ACCOUNT_CACHE_MS = 10_000;
const accountCache = new Map<string, { at: number; ok: boolean; role: string | null; storeId: string | null }>();
/** Drop a cached account status so a role change/deactivation applies at once. */
export function invalidateAccountCache(userId: string) { accountCache.delete(userId); }

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true, // required behind a proxy (Railway, etc.)
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findFirst({
          where: { email: { equals: credentials.email as string, mode: "insensitive" } },
          include: { store: true },
          omit: { passwordHash: false }, // needed to verify the password
        });

        if (!user?.passwordHash) return null;
        if (user.active === false) return null; // deactivated staff can't sign in

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) return null;

        // Record the sign-in (best-effort; never blocks login).
        try { await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }); } catch {}

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          storeId: user.storeId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.storeId = (user as any).storeId;
        return token;
      }
      // Existing session: re-check the account so a deactivated or deleted
      // staff member is signed out, and a role change applies without a
      // re-login. Cached briefly to avoid a lookup on every single request.
      const id = token.sub;
      if (!id) return token;
      const now = Date.now();
      let entry = accountCache.get(id);
      if (!entry || now - entry.at > ACCOUNT_CACHE_MS) {
        try {
          const u = await db.user.findUnique({ where: { id }, select: { active: true, role: true, storeId: true } });
          entry = { at: now, ok: !!u && u.active !== false, role: u ? String(u.role) : null, storeId: u?.storeId ?? null };
          accountCache.set(id, entry);
        } catch {
          return token; // database hiccup: don't sign everyone out
        }
      }
      if (!entry.ok) return null;
      token.role = entry.role;
      token.storeId = entry.storeId;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).storeId = token.storeId;
      }
      return session;
    },
  },
});
