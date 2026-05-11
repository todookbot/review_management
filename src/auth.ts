import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db }       from "@/db"
import { users, tenants } from "@/db/schema"
import { eq }       from "drizzle-orm"
import bcrypt       from "bcryptjs"
import type { DefaultSession } from "next-auth"

import { JWT } from "@auth/core/jwt"

declare module "@auth/core/jwt" {
  interface JWT {
    id:       string
    role:     string
    tenantId: string | null
    tenantSlug: string | null
  }
}

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id:       string
      role:     string
      tenantId: string | null
      tenantSlug: string | null
    }
  }
  interface User {
    id:       string
    role:     string
    tenantId: string | null
    tenantSlug: string | null
  }
}

// ─── NextAuth config ──────────────────────────────────────────────────────────

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  pages: {
    signIn:  "/login",
    error:   "/login",
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email    = credentials?.email    as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        const [user] = await db
          .select({
            id:           users.id,
            email:        users.email,
            name:         users.name,
            avatarUrl:    users.avatarUrl,
            role:         users.role,
            passwordHash: users.passwordHash,
            isActive:     users.isActive,
            tenantId:     users.tenantId,
          })
          .from(users)
          .where(eq(users.email, email.toLowerCase().trim()))
          .limit(1)

        if (!user || !user.isActive || !user.passwordHash) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        // Fetch tenant slug for routing
        let tenantSlug: string | null = null
        if (user.tenantId) {
          const [tenant] = await db
            .select({ slug: tenants.slug })
            .from(tenants)
            .where(eq(tenants.id, user.tenantId))
            .limit(1)
          tenantSlug = tenant?.slug ?? null
        }

        // Update last login
        await db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id))

        return {
          id:         user.id,
          email:      user.email,
          name:       user.name,
          image:      user.avatarUrl,
          role:       user.role ?? "VIEWER",
          tenantId:   user.tenantId,
          tenantSlug,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id         = user.id
        token.role       = user.role
        token.tenantId   = user.tenantId
        token.tenantSlug = user.tenantSlug
      }
      return token
    },
    async session({ session, token }) {
      session.user.id         = token.id
      session.user.role       = token.role
      session.user.tenantId   = token.tenantId
      session.user.tenantSlug = token.tenantSlug
      return session
    },
    async redirect({ url, baseUrl }) {
      // Relative URL — allow
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Same origin — allow
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
})
