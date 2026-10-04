import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  adminSchema, customOrderSchema, imageType, isSameOrigin, minDeliveryDate, orderSchema,
  ownerMatches, plainText, priceOrder, productSchema, validateDeliveryDate, encodeOrderCursor, decodeOrderCursor,
} from "../lib/server-validation.ts";
import { INITIAL_PRODUCTS } from "../lib/catalog.ts";

const now = new Date("2026-10-03T20:00:00Z"); // 4 October in Bangalore
const customer = { fullName:"Example Customer", phone:"+919876543210", address:"12 Example Road, Bangalore 560001" };
const item = { productId:"vanilla-sponge",quantity:1,weight:0.5,eggless:true,instructions:"Happy birthday",deliveryDate:"2026-10-06" };

test("all requested products are preloaded and IDs are unique", () => {
  assert.equal(INITIAL_PRODUCTS.length,28);
  assert.equal(new Set(INITIAL_PRODUCTS.map((p) => p.id)).size,28);
  assert.equal(INITIAL_PRODUCTS.filter((p) => p.collection === "Sponge cakes").length,5);
  assert.equal(INITIAL_PRODUCTS.filter((p) => p.collection === "Cheesecakes").length,8);
  assert.equal(INITIAL_PRODUCTS.filter((p) => p.category === "Brownies").length,10);
  assert.equal(INITIAL_PRODUCTS.filter((p) => p.category === "Blondies").length,4);
  for (const p of INITIAL_PRODUCTS) assert.equal(productSchema.safeParse(p).success,true);
});
test("prices come from inventory, never submitted cart values", () => {
  const order = priceOrder([{...item,expectedPrice:0.01}],INITIAL_PRODUCTS,now);
  assert.equal(order.items[0].unitCents,65000);
  assert.equal(order.totalCents,74900);
  const input = { items:[{...item,price:0.01}],customer,paymentMethod:"cod",idempotencyKey:"unique-checkout-key" };
  assert.equal(orderSchema.safeParse(input).success,false);
});
test("weights and box sizes have correct integer minor-unit totals", () => {
  const cake = priceOrder([{...item,weight:1,quantity:2}],INITIAL_PRODUCTS,now);
  assert.equal(cake.items[0].unitCents,130000);
  assert.equal(cake.totalCents,260000);
  const box = priceOrder([{...item,productId:"walnut-brownie",weight:6}],INITIAL_PRODUCTS,now);
  assert.equal(box.items[0].unitCents,57000);
  assert.equal(box.deliveryCents,9900);
  assert.throws(() => priceOrder([{...item,weight:12}],INITIAL_PRODUCTS,now),/supported/);
  assert.throws(() => priceOrder([{...item,productId:"walnut-brownie",weight:0.5}],INITIAL_PRODUCTS,now),/supported/);
});
test("sold out and removed products cannot be purchased", () => {
  assert.throws(() => priceOrder([item],INITIAL_PRODUCTS.map((p) => ({...p,available:false})),now),/unavailable/);
  assert.throws(() => priceOrder([{...item,productId:"unknown"}],INITIAL_PRODUCTS,now),/unavailable/);
});
test("dates use Bangalore day boundaries and reject invalid or past dates", () => {
  assert.equal(minDeliveryDate(now),"2026-10-06");
  assert.equal(validateDeliveryDate("2026-10-05",now),false);
  assert.equal(validateDeliveryDate("2026-10-06",now),true);
  assert.equal(validateDeliveryDate("2027-02-29",now),false);
  assert.equal(validateDeliveryDate("2028-10-06",now),false);
});
test("order validation bounds payload and requires identity-neutral fields", () => {
  const valid = { items:[item],customer,paymentMethod:"cod",idempotencyKey:"unique-checkout-key" };
  assert.equal(orderSchema.safeParse(valid).success,true);
  assert.equal(orderSchema.safeParse({...valid,userId:"other-user"}).success,false);
  assert.equal(orderSchema.safeParse({...valid,paymentMethod:"card",cardNumber:"123456"}).success,false);
  assert.equal(orderSchema.safeParse({...valid,items:[{...item,quantity:-1}]}).success,false);
  assert.equal(orderSchema.safeParse({...valid,items:[{...item,quantity:11}]}).success,false);
  assert.equal(orderSchema.safeParse({...valid,items:Array(21).fill(item)}).success,false);
});
test("owner access fails closed and does not grant first-user ownership", () => {
  const user = { userId:"user-one",email:"owner@example.com" };
  assert.equal(ownerMatches(user),false);
  assert.equal(ownerMatches(null,"owner@example.com"),false);
  assert.equal(ownerMatches(user,"someone@example.com"),false);
  assert.equal(ownerMatches(user,"OWNER@example.com"),true);
  assert.equal(ownerMatches(user,undefined,"user-one"),true);
  assert.equal(ownerMatches({...user,email:"owner@example.com.attacker.test"},"owner@example.com"),false);
});
test("cross-origin and opaque browser mutations are rejected", () => {
  const request = (origin,site) => new Request("https://bakery.example/api/orders",{method:"POST",headers:{...(origin ? {Origin:origin}:{}),...(site ? {"Sec-Fetch-Site":site}:{})}});
  assert.equal(isSameOrigin(request("https://bakery.example","same-origin")),true);
  assert.equal(isSameOrigin(request("https://attacker.example","cross-site")),false);
  assert.equal(isSameOrigin(request()),false);
  assert.equal(isSameOrigin(request("null","none")),false);
});
test("uploads validate magic bytes and never accept SVG or HTML", () => {
  assert.equal(imageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),null);
  assert.equal(imageType(new TextEncoder().encode('<html><script>alert(1)</script></html>')),null);
  assert.equal(imageType(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])),"image/png");
  assert.equal(imageType(new Uint8Array([255,216,255,224,0,0,0,0,0,0,0,0])),"image/jpeg");
  assert.equal(imageType(new TextEncoder().encode("RIFF0000WEBP")),"image/webp");
});
test("custom inspiration persists safely as plain text", () => {
  assert.equal(plainText('<p>A <strong>golden cake</strong></p><script>alert(1)</script>'),"A golden cake");
  const data = { inspiration:"A pretty floral birthday cake",bakingInstructions:"Less sugar",weight:1,eggless:true,deliveryDate:"2026-10-06",customer,idempotencyKey:"custom-order-unique" };
  assert.equal(customOrderSchema.safeParse(data).success,true);
  assert.equal(customOrderSchema.safeParse({...data,referenceKey:"../../other-person.png"}).success,false);
});
test("admin payload cannot inject HTML image URLs or duplicate inventory IDs", () => {
  assert.equal(adminSchema.safeParse({products:[INITIAL_PRODUCTS[0],INITIAL_PRODUCTS[0]]}).success,false);
  assert.equal(productSchema.safeParse({...INITIAL_PRODUCTS[0],image:"javascript:alert(1)"}).success,false);
  assert.equal(productSchema.safeParse({...INITIAL_PRODUCTS[0],price:-10}).success,false);
  assert.equal(adminSchema.safeParse({settings:{banner:"Seasonal specials",columns:5}}).success,false);
});

function freshDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(new URL("../drizzle/0000_graceful_beast.sql",import.meta.url),"utf8"));
  return db;
}
test("migration enforces user-scoped durable idempotency", () => {
  const db = freshDatabase();
  const insert = db.prepare("INSERT INTO orders (id,user_id,idempotency_key,customer_json,status,kind,total_cents,delivery_cents,payment_method,created_at,updated_at) VALUES (?,?,?,'{}','confirmed','standard',65000,9900,'cod',1,1)");
  insert.run("order-one","user-one","checkout-key");
  assert.throws(() => insert.run("order-two","user-one","checkout-key"),/UNIQUE/);
  insert.run("order-three","user-two","checkout-key");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM orders").get().count,2);
  db.close();
});
test("checkout batch rolls back when the guarded owner price changed", () => {
  const db = freshDatabase();
  db.exec("INSERT INTO products (id,name,category,collection,description,price_cents,image,featured,available,updated_at) VALUES ('cake','Cake','Cakes','Sponge cakes','Cake',75000,'/images/hero-cake.webp',1,1,1)");
  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare("INSERT INTO orders (id,user_id,idempotency_key,customer_json,status,kind,total_cents,delivery_cents,payment_method,created_at,updated_at) SELECT 'order-one','user-one','key','{}','confirmed','standard',65000,9900,'cod',1,1 WHERE EXISTS (SELECT 1 FROM products WHERE id=? AND price_cents=? AND available=1)").run("cake",65000);
    db.exec("INSERT INTO order_items (id,order_id,product_id,name,quantity,weight,eggless,instructions,delivery_date,unit_cents) VALUES ('item','order-one','cake','Cake',1,'0.5',1,'','2026-10-06',65000)");
    assert.fail("Foreign-key protection should prevent a stale-priced order");
  } catch (error) {
    db.exec("ROLLBACK");
    assert.match(error.message,/FOREIGN KEY/);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM orders").get().count,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM order_items").get().count,0);
  db.close();
});
test("durable SQL rate counter increments atomically and resets only on a new window", () => {
  const db = freshDatabase();
  const counter = db.prepare("INSERT INTO rate_limits (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start=excluded.window_start THEN count+1 ELSE 1 END,window_start=excluded.window_start RETURNING count");
  assert.equal(counter.get("orders:user-one",10).count,1);
  assert.equal(counter.get("orders:user-one",10).count,2);
  assert.equal(counter.get("orders:user-two",10).count,1);
  assert.equal(counter.get("orders:user-one",11).count,1);
  db.close();
});
test("same-price category changes cannot accept a cake size under brownie semantics", () => {
  const db = freshDatabase();
  db.exec("INSERT INTO products (id,name,category,collection,description,price_cents,image,featured,available,updated_at) VALUES ('cake','Cake','Brownies','Brownies','Cake',65000,'/images/hero-cake.webp',1,1,2)");
  const guard = db.prepare("SELECT COUNT(*) AS count FROM products WHERE id=? AND price_cents=? AND category=? AND name=? AND available=1");
  assert.equal(guard.get("cake",65000,"Cakes","Cake").count,0);
  assert.equal(guard.get("cake",65000,"Brownies","Cake").count,1);
  const product = {...INITIAL_PRODUCTS[0],category:"Brownies"};
  assert.throws(() => priceOrder([item],[product],now),/supported/);
  db.close();
});
test("composite order cursors do not skip rows with tied timestamps", () => {
  const db = freshDatabase();
  const insert = db.prepare("INSERT INTO orders (id,user_id,idempotency_key,customer_json,status,kind,total_cents,delivery_cents,payment_method,created_at,updated_at) VALUES (?,'user-one',?,'{}','confirmed','standard',65000,9900,'cod',100,100)");
  for (const id of ["order-a","order-b","order-c","order-d","order-e"]) insert.run(id,id);
  const first = db.prepare("SELECT id,created_at FROM orders ORDER BY created_at DESC,id DESC LIMIT 2").all();
  const cursor = decodeOrderCursor(encodeOrderCursor({createdAt:first[1].created_at,id:first[1].id}));
  assert.deepEqual(cursor,{createdAt:100,id:"order-d"});
  const second = db.prepare("SELECT id,created_at FROM orders WHERE created_at<? OR (created_at=? AND id<?) ORDER BY created_at DESC,id DESC LIMIT 2").all(cursor.createdAt,cursor.createdAt,cursor.id);
  const third = db.prepare("SELECT id,created_at FROM orders WHERE created_at<? OR (created_at=? AND id<?) ORDER BY created_at DESC,id DESC LIMIT 2").all(second[1].created_at,second[1].created_at,second[1].id);
  assert.deepEqual([...first,...second,...third].map((r) => r.id),["order-e","order-d","order-c","order-b","order-a"]);
  assert.equal(decodeOrderCursor("invalid!"),null);
  db.close();
});
test("a status-only update preserves the latest concurrent custom quote", () => {
  const db = freshDatabase();
  db.exec("INSERT INTO orders (id,user_id,idempotency_key,customer_json,status,kind,total_cents,delivery_cents,payment_method,created_at,updated_at) VALUES ('quote','user-one','quote-key','{}','quote_sent','custom',120000,0,'quote',1,1)");
  // An earlier status handler may have read 1200; the owner then quotes 1800 before that handler writes.
  db.exec("UPDATE orders SET total_cents=180000 WHERE id='quote'");
  db.prepare("UPDATE orders SET status=?,total_cents=CASE WHEN ? IS NOT NULL THEN ? ELSE total_cents END,updated_at=? WHERE id=? AND (status NOT IN ('delivered','cancelled') OR status=?)").run("confirmed",null,null,2,"quote","confirmed");
  assert.equal(db.prepare("SELECT total_cents FROM orders WHERE id='quote'").get().total_cents,180000);
  db.close();
});

test("brownies and blondies cannot be ordered with egg even in a tampered request", () => {
  for (const category of ["Brownies", "Blondies"]) {
    const product = INITIAL_PRODUCTS.find(p => p.category === category);
    const line = { ...item, productId: product.id, weight: 4 };
    assert.equal(priceOrder([line], INITIAL_PRODUCTS, now).items[0].eggless, true);
    assert.throws(() => priceOrder([{ ...line, eggless: false }], INITIAL_PRODUCTS, now), /always eggless/);
  }
  assert.equal(priceOrder([{ ...item, eggless: false }], INITIAL_PRODUCTS, now).items[0].eggless, false);
});
