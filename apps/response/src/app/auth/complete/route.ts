import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:4000";

export async function GET(request: Request): Promise<never> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) redirect("/?auth=missing-login-code");

  const response = await fetch(`${apiBaseUrl}/auth/bridge/consume`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
    cache: "no-store"
  });

  if (!response.ok) redirect("/?auth=login-bridge-expired");

  const payload = (await response.json()) as { sessionToken?: string };
  if (!payload.sessionToken) redirect("/?auth=missing-session-token");

  (await cookies()).set("persuando_user", payload.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: await shouldUseSecureCookie(request),
    path: "/"
  });

  redirect("/");
}

async function shouldUseSecureCookie(request: Request): Promise<boolean> {
  const forwardedProto = (await headers()).get("x-forwarded-proto");
  return new URL(request.url).protocol === "https:" || forwardedProto === "https" || apiBaseUrl.startsWith("https://");
}
