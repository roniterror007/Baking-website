import { ApiError, body, database, identity, json, mutation, orderById, rateLimit, route } from "@/lib/server-store";
import { statusSchema } from "@/lib/server-validation";
export async function PATCH(request: Request) {
  return route(async () => {
    mutation(request); const user = await identity(true); await rateLimit(user.userId,"admin-orders",60);
    const data = await body(request,statusSchema); const order = await orderById(data.orderId);
    if (!order) throw new ApiError(404,"order_not_found","This order could not be found.");
    if (data.status === "quote_sent" && (order.kind !== "custom" || !data.quoteTotal)) throw new ApiError(400,"invalid_quote","Set a quote price for a custom cake request.");
    if (data.quoteTotal !== undefined && order.kind !== "custom") throw new ApiError(400,"invalid_quote","Only custom requests accept quote prices.");
    if (["delivered","cancelled"].includes(order.status) && order.status !== data.status) throw new ApiError(409,"final_status","This order already has a final status.");
    const update = await database().prepare("UPDATE orders SET status=?, total_cents=CASE WHEN ? IS NOT NULL THEN ? ELSE total_cents END, updated_at=? WHERE id=? AND (status NOT IN ('delivered','cancelled') OR status=?)")
      .bind(data.status,data.quoteTotal !== undefined ? Math.round(data.quoteTotal*100) : null,data.quoteTotal !== undefined ? Math.round(data.quoteTotal*100) : null,Date.now(),data.orderId,data.status).run();
    if (!update.meta.changes) throw new ApiError(409,"final_status","This order already has a final status.");
    return json({ order:await orderById(data.orderId) });
  });
}
