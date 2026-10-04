import { ApiError, body, catalog, cursorFromRequest, database, identity, json, listOrders, mutation, nextOrderCursor, orderSummary, rateLimit, route, type SQLStatement } from "@/lib/server-store";
import { adminSchema } from "@/lib/server-validation";
export async function GET(request: Request) {
  return route(async () => { await identity(true);
    const [menu,orders,summary] = await Promise.all([catalog(),listOrders(undefined,cursorFromRequest(request),50),orderSummary()]);
    return json({ ...menu,orders,summary,nextCursor:nextOrderCursor(orders,50) }); });
}
export async function PUT(request: Request) {
  return route(async () => {
    mutation(request); const user = await identity(true); await rateLimit(user.userId,"admin",30);
    const data = await body(request,adminSchema,300000); const current = await catalog(); const now = Date.now(); const db = database();
    const categories = data.categories ?? current.categories;
    const nextProducts = data.products ?? current.products;
    if (nextProducts.some((p) => !categories.includes(p.collection))) throw new ApiError(400,"missing_category","Every product must belong to a saved collection.");
    const writes: SQLStatement[] = [];
    if (data.products) {
      const serialized = JSON.stringify(data.products.map((p) => ({ ...p,priceCents:Math.round(p.price*100) })));
      // JSON1 bulk operations avoid parameter/query ceilings as the inventory grows.
      writes.push(db.prepare("DELETE FROM products WHERE id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(?))").bind(serialized));
      writes.push(db.prepare(`INSERT INTO products (id,name,category,collection,description,price_cents,image,featured,available,updated_at)
        SELECT json_extract(value,'$.id'),json_extract(value,'$.name'),json_extract(value,'$.category'),json_extract(value,'$.collection'),
        json_extract(value,'$.description'),json_extract(value,'$.priceCents'),json_extract(value,'$.image'),json_extract(value,'$.featured'),
        json_extract(value,'$.available'),? FROM json_each(?) WHERE true
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,collection=excluded.collection,
        description=excluded.description,price_cents=excluded.price_cents,image=excluded.image,featured=excluded.featured,available=excluded.available,updated_at=excluded.updated_at`).bind(now,serialized));
    }
    for (const [key,value] of Object.entries({ ...(data.settings ? { settings:data.settings } : {}),...(data.categories ? { categories:data.categories } : {}) })) {
      writes.push(db.prepare("INSERT INTO shop_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(key,JSON.stringify(value),now));
    }
    await db.batch(writes);
    return json(await catalog());
  });
}
