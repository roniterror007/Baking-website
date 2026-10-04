import { authClient } from "@/lib/supabase-server";
import { json, mutation, route } from "@/lib/server-store";
export async function POST(request: Request) {
  return route(async () => {
    mutation(request);
    const client = await authClient();
    if (client) { const { error } = await client.auth.signOut({ scope: "local" }); if (error) return json({ error: "sign_out_failed" }, 503); }
    return json({ signedOut: true });
  });
}
