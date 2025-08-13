import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import { neon } from "@neondatabase/serverless";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.provider = token.provider as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      try {
        const sql = neon(process.env.DATABASE_URL!);
        await sql`CREATE TABLE IF NOT EXISTS users (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email text UNIQUE,
          name text,
          image text,
          providers text[] DEFAULT '{}'
        )`;

        const existing = (await sql`  
          SELECT id FROM users WHERE email = ${user.email}
        `) as Array<{ id: string }>; 

        if (existing.length > 0) {
          await sql`
            UPDATE users
            SET name = ${user.name}, image = ${user.image}, providers = array(SELECT DISTINCT unnest(providers || ${account?.provider ?? ''}))
            WHERE email = ${user.email}
          `;
        } else {
          await sql`
            INSERT INTO users (email, name, image, providers)
            VALUES (${user.email}, ${user.name}, ${user.image}, ARRAY[${account?.provider ?? ''}]::text[])
          `;
        }
        return true;
      } catch (error) {
        console.error("Error during sign in:", error);
        return false;
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
};
