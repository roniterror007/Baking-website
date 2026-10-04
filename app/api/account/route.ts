import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isOwner, json, listOrders, nextOrderCursor, profile, route } from "@/lib/server-store";
export async function GET() {
  return route(async () => {
    const user = await getChatGPTUser();
    if (!user) return json({ user:null, profile:null, orders:[], isAdmin:false, nextCursor:null });
    const [savedProfile, orders] = await Promise.all([profile(user.userId), listOrders(user.userId)]);
    return json({ user, profile:savedProfile, orders, isAdmin:isOwner(user), nextCursor:nextOrderCursor(orders,30) });
  });
}
