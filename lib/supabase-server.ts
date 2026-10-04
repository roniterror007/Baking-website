import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export async function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const jar = await cookies();
  return createServerClient(url, key, { cookies: {
    getAll: () => jar.getAll(),
    setAll: (values) => { for (const { name, value, options } of values) jar.set(name, value, options); },
  } });
}
export function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Private image storage is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
