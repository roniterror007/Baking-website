import { ApiError, body, catalog, cursorFromRequest, database, identity, json, listOrders, mutation, nextOrderCursor, orderById, priorOrder, rateLimit, route } from "@/lib/server-store";
import { orderSchema, priceOrder } from "@/lib/server-validation";
export async function GET(request: Request) {
  return route(async () => { const user = await identity(); const orders = await listOrders(user.userId,cursorFromRequest(request));
    return json({ orders,nextCursor:nextOrderCursor(orders,30) }); });
}
export async function POST(request: Request) {
  return route(async () => {
    mutation(request); const user = await identity(); await rateLimit(user.userId,"orders",10);
    const data = await body(request,orderSchema);
    const previous = await priorOrder(user.userId,data.idempotencyKey); if (previous) return json({ order:previous });
    const menu = await catalog(); let priced;
    try { priced = priceOrder(data.items,menu.products); }
    catch (error) { throw new ApiError(400,"invalid_order",error instanceof Error ? error.message : "Check your order selections."); }
    const changed = data.items.some((item,index) => item.expectedPrice !== undefined && Math.round(item.expectedPrice*100) !== priced.items[index].unitCents)
      || (data.expectedTotal !== undefined && Math.round(data.expectedTotal*100) !== priced.totalCents);
    if (changed) throw new ApiError(409,"price_changed","The menu prices changed. Please review your cart before placing the order.", { currentTotal:priced.totalCents/100,products:menu.products });
    const now = Date.now(); const id = `GD-${crypto.randomUUID().slice(0,8).toUpperCase()}-${now.toString(36)}`;
    const db = database();
    // Guard the snapshot inside the atomic batch: a simultaneous owner price change causes rollback, never a stale-priced order.
    const uniqueProducts = [...new Set(data.items.map((item) => item.productId))];
    const guard = uniqueProducts.map(() => "EXISTS (SELECT 1 FROM products WHERE id=? AND price_cents=? AND category=? AND name=? AND available=1)").join(" AND ");
    const guardValues = uniqueProducts.flatMap((id) => { const product = menu.products.find((p) => p.id === id)!;
      return [id,Math.round(product.price*100),product.category,product.name]; });
    const writes = [db.prepare(`INSERT INTO orders (id,user_id,idempotency_key,customer_json,status,kind,total_cents,delivery_cents,payment_method,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${guard}`).bind(id,user.userId,data.idempotencyKey,JSON.stringify(data.customer),"confirmed","standard",priced.totalCents,priced.deliveryCents,"cod",now,now,...guardValues)];
    for (const item of priced.items) writes.push(db.prepare(`INSERT INTO order_items (id,order_id,product_id,name,quantity,weight,eggless,instructions,delivery_date,unit_cents)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,item.productId,item.name,item.quantity,String(item.weight),Number(item.eggless),item.instructions,item.deliveryDate,item.unitCents));
    try { await db.batch(writes); }
    catch (error) {
      const duplicate = await priorOrder(user.userId,data.idempotencyKey); if (duplicate) return json({ order:duplicate });
      const current = await catalog();
      if (current.products.some((p) => { const old = menu.products.find((old) => old.id === p.id); return uniqueProducts.includes(p.id)
        && (!p.available || p.price !== old?.price || p.category !== old?.category || p.name !== old?.name); })
        || uniqueProducts.some((id) => !current.products.some((p) => p.id === id))) {
        throw new ApiError(409,"price_changed","The menu changed while you checked out. Please review your cart.", { products:current.products });
      }
      throw error;
    }
    return json({ order:await orderById(id,user.userId) },201);
  });
}
