import assert from "node:assert/strict";
import { minDeliveryDate } from "../lib/server-validation.ts";

// Intentionally restricted to loopback. These fixtures must never create production orders.
const base = "http://127.0.0.1:5173";
let cookie;
async function api(path,options = {},authenticated = true) {
  const headers = { Origin:base,...(authenticated && cookie ? { Cookie:cookie } : {}),...(options.body && !(options.body instanceof FormData) ? { "Content-Type":"application/json" } : {}),...options.headers };
  const response = await fetch(`${base}${path}`,{...options,headers});
  const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  return { status:response.status,data,headers:response.headers };
}
const anonymous = await api("/api/account",{},false);
assert.equal(anonymous.data.user,null);
assert.equal((await api("/api/admin",{headers:{"oai-authenticated-user-id":"local_seedy","oai-authenticated-user-email":"seedy@sites.test"}},false)).status,401);
assert.equal((await api("/api/orders",{method:"POST",body:"{}"},false)).status,401);
const signIn = await fetch(`${base}/signin-with-chatgpt?return_to=/`,{redirect:"manual"});
assert.equal(signIn.status,302);
cookie = signIn.headers.get("set-cookie")?.split(";")[0]; assert.ok(cookie);
const account = await api("/api/account");
assert.equal(account.status,200); assert.equal(account.data.isAdmin,true);
const menu = await api("/api/catalog"); assert.equal(menu.status,200); assert.equal(menu.data.products.length,28);
const admin = await api("/api/admin"); assert.equal(admin.status,200);
const customer = {fullName:"Local API Verification",phone:"+919876543210",address:"12 Test Lane, Bangalore 560001",billingAddress:"12 Test Lane, Bangalore 560001"};
const product = menu.data.products.find((p) => p.id === "vanilla-sponge");
const key = crypto.randomUUID();
const orderInput = {items:[{productId:product.id,quantity:1,weight:0.5,eggless:true,instructions:"Local test order",deliveryDate:minDeliveryDate(),expectedPrice:product.price}],customer,paymentMethod:"cod",expectedTotal:product.price+99,idempotencyKey:key};
assert.equal((await api("/api/orders",{method:"POST",headers:{Origin:"https://attacker.example"},body:JSON.stringify(orderInput)})).status,403);
assert.equal((await api("/api/orders",{method:"POST",body:JSON.stringify({...orderInput,expectedTotal:0.01})})).status,409);
const placed = await api("/api/orders",{method:"POST",body:JSON.stringify(orderInput)});
assert.equal(placed.status,201,JSON.stringify(placed.data)); assert.equal(placed.data.order.total,product.price+99);
const repeated = await api("/api/orders",{method:"POST",body:JSON.stringify(orderInput)});
assert.equal(repeated.data.order.id,placed.data.order.id);
const altered = menu.data.products.map((p) => p.id === "healthy-brownie" ? {...p,price:p.price+1} : p);
try {
  const updated = await api("/api/admin",{method:"PUT",body:JSON.stringify({products:altered,settings:menu.data.settings,categories:menu.data.categories})});
  assert.equal(updated.status,200,JSON.stringify(updated.data));
  const fresh = await api("/api/catalog");
  assert.equal(fresh.data.products.find((p) => p.id === "healthy-brownie").price,altered.find((p) => p.id === "healthy-brownie").price);
} finally {
  const restored = await api("/api/admin",{method:"PUT",body:JSON.stringify({products:menu.data.products,settings:menu.data.settings,categories:menu.data.categories})});
  assert.equal(restored.status,200,JSON.stringify(restored.data));
}
const invalid = new FormData(); invalid.append("file",new File(["<html><script>alert(1)</script></html>"],"pretend.png",{type:"image/png"}));
assert.equal((await api("/api/uploads",{method:"POST",body:invalid})).status,415);
const image = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlHcAAAAASUVORK5CYII=","base64"));
const form = new FormData(); form.append("file",new File([image],"test.png",{type:"image/png"}));
const upload = await api("/api/uploads",{method:"POST",body:form}); assert.equal(upload.status,201,JSON.stringify(upload.data));
const reference = await fetch(`${base}${upload.data.url}`,{headers:{Cookie:cookie}});
assert.equal(reference.status,200); assert.equal(reference.headers.get("content-type"),"image/png");
assert.equal((await fetch(`${base}${upload.data.url}`)).status,401);
const customInput = {inspiration:"<p>A golden floral cake</p><script>alert(1)</script>",bakingInstructions:"Less sugar",weight:2.5,eggless:true,deliveryDate:minDeliveryDate(),referenceKey:upload.data.referenceKey,customer,idempotencyKey:crypto.randomUUID()};
const custom = await api("/api/custom-orders",{method:"POST",body:JSON.stringify(customInput)});
assert.equal(custom.status,201,JSON.stringify(custom.data)); assert.equal(custom.data.order.status,"quote_requested");
assert.equal(custom.data.order.custom.inspiration,"A golden floral cake");
const quote = await api("/api/admin/orders",{method:"PATCH",body:JSON.stringify({orderId:custom.data.order.id,status:"quote_sent",quoteTotal:1800})});
assert.equal(quote.status,200); assert.equal(quote.data.order.total,1800);
const status = await api("/api/admin/orders",{method:"PATCH",body:JSON.stringify({orderId:custom.data.order.id,status:"confirmed"})});
assert.equal(status.status,200); assert.equal(status.data.order.total,1800);
for (const orderId of [placed.data.order.id,custom.data.order.id]) {
  assert.equal((await api("/api/admin/orders",{method:"PATCH",body:JSON.stringify({orderId,status:"cancelled"})})).status,200);
}
const history = await api("/api/orders"); assert.ok(history.data.orders.some((o) => o.id === placed.data.order.id));
assert.equal((await api("/api/orders?cursor=invalid!")).status,400);
console.log("Local D1/R2 API integration passed: identity/header rejection, origin guard, stale prices, idempotency, CMS persistence, private uploads, custom quote/status, and order history.");
