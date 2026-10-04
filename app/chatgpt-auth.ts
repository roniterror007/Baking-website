import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase-server";
import { safeReturnPath } from "@/lib/auth-paths";
// Existing API interface; identity now comes from Supabase, never request headers.
export type ChatGPTUser = { userId: string; displayName: string; email: string; fullName: string | null };
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const client = await authClient();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at) return null;
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return { userId: user.id, email: user.email, displayName: fullName || user.email, fullName };
}
export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}
export const chatGPTSignInPath = (returnTo: string) => `/sign-in?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
export const chatGPTSignOutPath = (returnTo = "/") => `/sign-out?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
