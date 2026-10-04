import test from "node:test";
import assert from "node:assert/strict";
import { cartTotals, parseSavedCart, unitPricePaise } from "../lib/cart.ts";
import { priceOrder } from "../lib/server-validation.ts";
import { INITIAL_PRODUCTS } from "../lib/catalog.ts";

const now = new Date("2026-10-03T20:00:00Z");
const template = { key: "line-one", product: INITIAL_PRODUCTS[0], quantity: 1, weight: 0.5, eggless: true, instructions: "", deliveryDate: "2026-10-06" };

test("fractional INR prices at the free-delivery threshold agree with the server", () => {
  const products = [426.51, 599.90, 473.59].map((price, index) => ({ ...INITIAL_PRODUCTS[0], id: `decimal-${index}`, price }));
  const lines = products.map(product => ({ ...template, key: product.id, product }));
  const result = cartTotals(lines);
  assert.deepEqual(result, { subtotalPaise: 150000, deliveryPaise: 0, totalPaise: 150000 });
  const server = priceOrder(lines.map(line => ({ productId: line.product.id, quantity: line.quantity, weight: line.weight, eggless: line.eggless, instructions: line.instructions, deliveryDate: line.deliveryDate })), products, now);
  assert.equal(result.totalPaise, server.totalCents);
  assert.equal(cartTotals([{ ...template, product: { ...template.product, price: 1499.99 } }]).deliveryPaise, 9900);
});
test("fractional box multipliers round once in paise, then multiply quantities", () => {
  const product = { ...INITIAL_PRODUCTS[0], category: "Brownies", price: 100.01 };
  assert.equal(unitPricePaise(product, 6), 15002);
  assert.deepEqual(cartTotals([{ product, weight: 6, quantity: 3 }]), { subtotalPaise: 45006, deliveryPaise: 9900, totalPaise: 54906 });
  assert.deepEqual(cartTotals([]), { subtotalPaise: 0, deliveryPaise: 0, totalPaise: 0 });
});
test("persisted carts reject invalid dates, malformed products, quantities and duplicate keys", () => {
  assert.equal(parseSavedCart([template], now).length, 1);
  assert.deepEqual(parseSavedCart([{ ...template, deliveryDate: "2027-02-29" }], now), []);
  assert.deepEqual(parseSavedCart([{ ...template, deliveryDate: "2099-01-01" }], now), []);
  assert.deepEqual(parseSavedCart([{ ...template, product: { ...template.product, name: {} } }], now), []);
  assert.deepEqual(parseSavedCart([{ ...template, quantity: 11 }], now), []);
  assert.deepEqual(parseSavedCart([{ ...template, product: { ...template.product, image: "https://example.test/tracker.png" } }], now), []);
  assert.equal(parseSavedCart([template, template], now).length, 1);
  assert.deepEqual(parseSavedCart({ product: template.product }, now), []);
});

test("saved brownie and blondie carts are migrated to eggless", () => {
  for (const category of ["Brownies", "Blondies"]) {
    const product = INITIAL_PRODUCTS.find(p => p.category === category);
    assert.equal(parseSavedCart([{ ...template, product, weight: 4, eggless: false }], now)[0].eggless, true);
  }
});
