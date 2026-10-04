import { authClient } from "@/lib/supabase-server";
import { safeReturnPath } from "@/lib/auth-paths";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url), code = url.searchParams.get("code");
  const next = safeReturnPath(url.searchParams.get("next"));
  const client = await authClient();
  if (client && code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(`/sign-in?error=expired&return_to=${encodeURIComponent(next)}`, url.origin));
}
