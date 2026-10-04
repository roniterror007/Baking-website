import { body, database, identity, json, mutation, profile, rateLimit, route } from "@/lib/server-store";
import { profileSchema } from "@/lib/server-validation";
export async function GET() { return route(async () => { const user = await identity(); return json({ profile:await profile(user.userId) }); }); }
export async function PUT(request: Request) {
  return route(async () => {
    mutation(request); const user = await identity(); await rateLimit(user.userId,"profile",15);
    const data = await body(request,profileSchema);
    await database().prepare(`INSERT INTO profiles (user_id,full_name,phone,address,billing_address,saved_payment_method,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,phone=excluded.phone,
      address=excluded.address,billing_address=excluded.billing_address,saved_payment_method=excluded.saved_payment_method,updated_at=excluded.updated_at`)
      .bind(user.userId,data.fullName,data.phone,data.address,data.billingAddress || data.address,data.savedPaymentMethod,Date.now()).run();
    return json({ profile:await profile(user.userId) });
  });
}
