import { auth } from "@/app/auth"
import type { Session } from "next-auth"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const typedSession = session as Session

  let emails: Array<{ email: string; primary?: boolean; verified?: boolean }> | undefined
  if (typedSession.githubAccessToken) {
    try {
      const res = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `token ${typedSession.githubAccessToken}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      })
      if (res.ok) {
        emails = (await res.json()) as Array<{ email: string; primary?: boolean; verified?: boolean }>
      }
    } catch {
      // ignore
    }
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      user: typedSession.user,
      emails,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  )
}


