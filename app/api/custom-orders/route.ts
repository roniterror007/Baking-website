import { ApiError, body, database, identity, json, mutation, orderById, priorOrder, rateLimit, route } from "@/lib/server-store";
import { customOrderSchema, plainText, validateDeliveryDate } from "@/lib/server-validation";
export async function POST(request: Request) {
  return route(async () => {
    mutation(request); const user = await identity(); await rateLimit(user.userId,"custom-orders",5);
    const data = await body(request,customOrderSchema,40000);
    const previous = await priorOrder(user.userId,data.idempotencyKey); if (previous) return json({ order:previous });
    if (!validateDeliveryDate(data.deliveryDate)) throw new ApiError(400,"invalid_date","Choose a delivery date at least two days from today, within the next year.");
    const inspiration = plainText(data.inspiration); if (inspiration.length < 5) throw new ApiError(400,"invalid_inspiration","Describe your cake inspiration in a little more detail.");
    const db = database();
    if (data.referenceKey && !await db.prepare("SELECT key FROM uploads WHERE key=? AND user_id=?").bind(data.referenceKey,user.userId).first()) {
      throw new ApiError(400,"invalid_reference","Upload your own cake reference image first.");
    }
    const custom = { inspiration, bakingInstructions:plainText(data.bakingInstructions), weight:data.weight, eggless:data.eggless,
      deliveryDate:data.deliveryDate, referenceKey:data.referenceKey ?? null };
    const now = Date.now(); const id = `GD-C-${crypto.randomUUID().slice(0,8).toUpperCase()}-${now.toString(36)}`;
    try {
      await db.prepare(`INSERT INTO orders (id,user_id,idempotency_key,customer_json,status,kind,total_cents,delivery_cents,payment_method,custom_json,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.userId,data.idempotencyKey,JSON.stringify(data.customer),"quote_requested","custom",0,0,"quote",JSON.stringify(custom),now,now).run();
    } catch (error) { const duplicate = await priorOrder(user.userId,data.idempotencyKey); if (duplicate) return json({ order:duplicate }); throw error; }
    return json({ order:await orderById(id,user.userId) },201);
  });
}
