import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Credentials from "@auth/core/providers/credentials"
import type { JWT } from "next-auth/jwt"
import type { Session, User, Account } from "next-auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(
        credentials: Partial<Record<"email" | "password", unknown>>,
        _req: Request
      ) {
        const email = typeof credentials.email === "string" ? credentials.email : ""
        const password = typeof credentials.password === "string" ? credentials.password : ""

        // DEMO ONLY: replace with your real user lookup + password check
        if (email === "test@example.com" && password === "password123") {
          return { id: email, email, name: "Test User" }
        }
        return null
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline", 
          response_type: "code",
          scope: "openid email profile",
        }
      }
    })
  ],
  callbacks: {
    async session({ token, session }: { token: JWT; session: Session }) {
      if (session.user) {
        const idFromToken = typeof token.id === "string" ? token.id : (typeof token.sub === "string" ? token.sub : undefined)
        if (idFromToken) {
          session.user.id = idFromToken
        }
        if (typeof token.name === "string" || token.name === null) {
          session.user.name = token.name ?? session.user.name
        }
        if (typeof token.email === "string" || token.email === null) {
          session.user.email = token.email ?? session.user.email
        }
        if (typeof token.picture === "string" || token.picture === null) {
          session.user.image = token.picture ?? session.user.image
        }
      }
      if (typeof (token as JWT & { githubAccessToken?: string }).githubAccessToken === "string") {
        ;(session as Session & { githubAccessToken?: string }).githubAccessToken = (token as JWT & { githubAccessToken?: string }).githubAccessToken
      }
      return session
    },
    async jwt({ token, user, account }: { token: JWT; user?: User | null; account?: Account | null }) {
      if (user?.id) {
        token.id = user.id
      }
      // Persist GitHub access token and ensure email exists
      if (account?.provider === "github") {
        const accessToken = account.access_token ?? undefined
        if (accessToken) {
          ;(token as JWT & { githubAccessToken?: string }).githubAccessToken = accessToken
        }
        if (!token.email && accessToken) {
          try {
            const res = await fetch("https://api.github.com/user/emails", {
              headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/vnd.github+json",
              },
              cache: "no-store",
            })
            if (res.ok) {
              const emails: Array<{ email: string; primary?: boolean; verified?: boolean }> = await res.json()
              const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.primary) || emails[0]
              if (primary?.email) token.email = primary.email
            }
          } catch {
            // ignore
          }
        }
      }
      return token
    },
  },
})
