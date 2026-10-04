import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresDatabase, postgresSQL } from '../lib/postgres-store.ts';
import { safeReturnPath } from '../lib/auth-paths.ts';

async function fixture() {
  const pg = new PGlite();
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
  await pg.exec(await readFile(new URL('../supabase/migrations/0001_bakery.sql', import.meta.url),'utf8'));
  const executor = { async query(sql,values=[]) { const result = await pg.query(sql,values); return {rows:result.rows,rowCount:result.affectedRows ?? result.rows.length}; }, release() {} };
  const db = createPostgresDatabase(() => executor,async()=>executor);
  return {pg,db};
}
const productSQL='INSERT OR IGNORE INTO products (id,name,category,collection,description,price_cents,image,featured,available,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)';
const productValues=['cake','Vanilla','Cakes','Sponge cakes','Fresh',65000,'/images/catalog-01.webp',1,1,1000];

test('Supabase schema denies direct client table access and keeps references private',async()=>{
  const {pg}=await fixture();
  try {
    const {rows}=await pg.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('products','orders','order_items','profiles','rate_limits','shop_settings','uploads') AND relnamespace='public'::regnamespace");
    assert.equal(rows.length,7);assert.ok(rows.every(row=>row.relrowsecurity));
    assert.equal((await pg.query("SELECT public FROM storage.buckets WHERE id='cake-references'")).rows[0].public,false);
    await pg.exec('SET ROLE anon;');
    await assert.rejects(pg.query('SELECT * FROM public.orders'),/permission denied/);
    await pg.exec('RESET ROLE;');
  } finally {await pg.close();}
});
test('catalog seeding preserves owner pricing and binds punctuation safely',async()=>{
  const {pg,db}=await fixture();
  try {
    await db.prepare(productSQL).bind(...productValues).run();
    await db.prepare('UPDATE products SET price_cents=? WHERE id=?').bind(123456,'cake').run();
    await db.prepare(productSQL).bind(...productValues).run();
    assert.equal((await db.prepare('SELECT price_cents FROM products WHERE id=?').bind('cake').first()).price_cents,123456);
    assert.equal(postgresSQL("SELECT '?' AS literal, ? AS value, 'isn''t ?' AS other"),"SELECT '?' AS literal, $1 AS value, 'isn''t ?' AS other");
    const name="Customer's ? cake'; DROP TABLE products;--";
    await db.prepare('UPDATE products SET name=? WHERE id=?').bind(name,'cake').run();
    assert.equal((await db.prepare('SELECT name FROM products WHERE id=?').bind('cake').first()).name,name);
  } finally {await pg.close();}
});
test('the actual first-request initializer seeds the exported menu only once',async()=>{
  const {pg,db}=await fixture();
  try {
    const source=await readFile(new URL('../lib/server-store.ts',import.meta.url),'utf8');
    const snapshot=JSON.parse(await readFile(new URL('../supabase/catalog-import.json',import.meta.url),'utf8'));
    const body=source.match(/export async function ensureCatalog\(\): Promise<void> \{([\s\S]*?)\r?\n\}\r?\nexport async function catalog/)[1];
    const initialize=new (Object.getPrototypeOf(async()=>{}).constructor)('database','startingCatalog','INITIAL_PRODUCTS','DEFAULT_SETTINGS','CATEGORIES',body);
    await initialize(()=>db,snapshot,[],{},[]);
    assert.equal((await db.prepare('SELECT count(*)::integer AS n FROM products').first()).n,snapshot.products.length);
    const id=snapshot.products[0].id;
    assert.equal((await db.prepare('SELECT price_cents FROM products WHERE id=?').bind(id).first()).price_cents,Math.round(snapshot.products[0].price*100));
    assert.deepEqual(JSON.parse((await db.prepare("SELECT value FROM shop_settings WHERE key='settings'").first()).value),snapshot.settings);
    await db.prepare('UPDATE products SET price_cents=? WHERE id=?').bind(123456,id).run();
    await initialize(()=>db,snapshot,[],{},[]);
    assert.equal((await db.prepare('SELECT price_cents FROM products WHERE id=?').bind(id).first()).price_cents,123456);
  } finally {await pg.close();}
});
test('actual owner JSON bulk save handles boolean availability and integer prices',async()=>{
  const {pg,db}=await fixture();
  try {
    const source=await readFile(new URL('../app/api/admin/route.ts',import.meta.url),'utf8');
    const bulk=source.match(/db\.prepare\(`(INSERT INTO products[\s\S]*?)`\)\.bind\(now,serialized\)/)[1];
    const remove=source.match(/db\.prepare\("(DELETE FROM products[^"]+)"\)/)[1];
    const products=[{id:'cake',name:'Vanilla',category:'Cakes',collection:'Sponge cakes',description:'Handcrafted',priceCents:123456,image:'/images/catalog-01.webp',featured:true,available:false}];
    await db.batch([db.prepare(remove).bind(JSON.stringify(products)),db.prepare(bulk).bind(2000,JSON.stringify(products))]);
    const row=await db.prepare('SELECT * FROM products').first();
    assert.equal(row.price_cents,123456);assert.equal(row.featured,1);assert.equal(row.available,0);
  } finally {await pg.close();}
});
test('checkout batch rolls back every item when snapshot guard or later insert fails',async()=>{
  const {pg,db}=await fixture();
  try {
    await db.prepare(productSQL).bind(...productValues).run();
    const order=(id,key,price)=>db.prepare("INSERT INTO orders(id,user_id,idempotency_key,customer_json,status,kind,total_cents,delivery_cents,payment_method,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM products WHERE id=? AND price_cents=? AND available=1)").bind(id,'customer',key,'{}','confirmed','standard',65000,0,'cod',1000,1000,'cake',price);
    const item=(id,orderId)=>db.prepare('INSERT INTO order_items(id,order_id,product_id,name,quantity,weight,eggless,instructions,delivery_date,unit_cents) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,orderId,'cake','Vanilla',1,'0.5',1,'','2026-10-10',65000);
    await assert.rejects(db.batch([order('failed','failed-key',999),item('item-failed','failed')]),/foreign key/);
    assert.equal((await db.prepare('SELECT count(*)::integer AS n FROM orders').first()).n,0);
    await assert.rejects(db.batch([order('rollback','rollback-key',65000),item('duplicate','rollback'),item('duplicate','rollback')]),/duplicate key/);
    assert.equal((await db.prepare('SELECT count(*)::integer AS n FROM orders').first()).n,0);
    await db.batch([order('ok','ok-key',65000),item('item-ok','ok')]);
    await assert.rejects(db.batch([order('again','ok-key',65000),item('again-item','again')]),/duplicate key/);
    assert.equal((await db.prepare('SELECT count(*)::integer AS n FROM orders').first()).n,1);
  } finally {await pg.close();}
});
test('durable limits and nullable quote updates execute as PostgreSQL',async()=>{
  const {pg,db}=await fixture();
  try {
    const store=await readFile(new URL('../lib/server-store.ts',import.meta.url),'utf8');
    const rateSQL=store.match(/\.prepare\(`(INSERT INTO rate_limits[\s\S]*?)`\)/)[1];
    assert.equal((await db.prepare(rateSQL).bind('orders:user',100).first()).count,1);
    assert.equal((await db.prepare(rateSQL).bind('orders:user',100).first()).count,2);
    assert.equal((await db.prepare(rateSQL).bind('orders:user',101).first()).count,1);
    await db.prepare("INSERT INTO orders(id,user_id,idempotency_key,customer_json,status,kind,total_cents,delivery_cents,payment_method,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind('quote','owner','quote-key','{}','confirmed','custom',0,0,'cod',1000,1000).run();
    const source=await readFile(new URL('../app/api/admin/orders/route.ts',import.meta.url),'utf8');
    const updateSQL=source.match(/\.prepare\("(UPDATE orders[^"]+)"\)/)[1];
    assert.equal((await db.prepare(updateSQL).bind('baking',null,null,2000,'quote','baking').run()).meta.changes,1);
    await db.prepare(updateSQL).bind('quote_sent',123456,123456,2001,'quote','quote_sent').run();
    assert.equal((await db.prepare('SELECT total_cents FROM orders WHERE id=?').bind('quote').first()).total_cents,123456);
  } finally {await pg.close();}
});
test('auth return paths reject external origins, protocol-relative URLs and auth loops',()=>{
  for(const path of ['https://evil.test','//evil.test','/\\evil.test','/auth/callback','/sign-in','/sign-out']) assert.equal(safeReturnPath(path),'/');
  assert.equal(safeReturnPath('/admin?view=orders'),'/admin?view=orders');
});

test('owner summary covers every order and excludes cancellations and unquoted requests from booked value',async()=>{
  const {pg,db}=await fixture();
  try {
    for (const [id,status,kind,total] of [['one','delivered','standard',10000],['two','confirmed','custom',20000],['three','cancelled','standard',90000],['four','quote_requested','custom',0]]) {
      await db.prepare("INSERT INTO orders(id,user_id,idempotency_key,customer_json,status,kind,total_cents,delivery_cents,payment_method,created_at,updated_at) VALUES(?,?,?,'{}',?,?,?,0,'cod',1,1)").bind(id,'customer',id,status,kind,total).run();
    }
    const source=await readFile(new URL('../lib/server-store.ts',import.meta.url),'utf8');
    const sql=source.match(/export async function orderSummary[\s\S]*?prepare\(`([\s\S]*?)`\)/)[1];
    const summary=await db.prepare(sql).first();
    assert.equal(Number(summary.orders),4); assert.equal(Number(summary.requests),2);
    assert.equal(Number(summary.booked),30000); assert.equal(Number(summary.delivered),10000);
  } finally {await pg.close();}
});
