# Golden Delights operations

**Current hosting:** the source now targets Vercel + Supabase. [VERCEL.md](VERCEL.md) documents the current PostgreSQL migration, verified email sign-in, private storage, deployment configuration and tests. The remaining material below records the previous Sites/Cloudflare implementation and its historical checks; its dispatch authentication, Wrangler commands and D1/R2 integration script must not be used to configure the new deployment.

The store uses Cloudflare edge Workers, a durable D1 SQL database and private R2 reference images. The generated `drizzle/0000_graceful_beast.sql` migration creates seven tables with indexes on product categories, customer order history, order status, attachments and the SQL rate limiter. Schema creation never occurs in request handlers. The first catalog request seeds the 28 requested menu items once; owner changes then remain authoritative and durable.

## Deployment

Set `.openai/hosting.json` bindings to `DB` and `BUCKET`. Sites applies the generated schema migration to the real D1 database during publishing. For a local preview, build first and apply the migration once:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_graceful_beast.sql
```

Configure a private `OWNER_EMAIL` or `OWNER_USER_ID` environment variable before enabling the owner portal. Values are exact dispatch-verified identities; comma-separated allowlists are supported. No owner is inferred from the first account or public input. Local previews use the starter's development authentication identity only; set its owner email in an ignored `.dev.vars` file for testing. The published dispatcher owns authentication and removes untrusted incoming identity headers. The existing `app/chatgpt-auth.ts` helper is the only identity source. Sign-in and sign-out use the native ChatGPT login routes.

The sample prices are in INR. Owner writes update the catalog in one SQL batch; public catalog reads are `no-store`, so refreshed storefronts receive current prices immediately. Checkout recomputes every price from D1 and checks the client's expected price. A concurrent owner edit also causes a transactional rollback and HTTP 409 rather than placing an order at a stale price. Payment is cash on delivery; accounts can retain COD/UPI preferences, with no card data stored and no simulated online payment success.

## API

- `GET /api/catalog` (alias `/api/products`): products, settings (`banner`, `columns`), collection names.
- `GET /api/account`: dispatch identity, saved profile, latest 30 customer orders, owner permission.
- `GET/PUT /api/profile`: customer's own contact/address data and `savedPaymentMethod` preference.
- `POST /api/orders`: standard items, customer, `paymentMethod: "cod"`, `idempotencyKey`; optional `expectedTotal` and item `expectedPrice`. Prices use the 0.5 kg cake base or a box of four brownie/blondie base. Delivery is ₹99, free from ₹1,500.
- `GET /api/orders?cursor=<nextCursor>`: bounded customer history pagination. Account, order-history and admin responses include `nextCursor`; it encodes the `(created_at,id)` ordering so simultaneous timestamps do not skip rows. Legacy numeric `before` is retained.
- `POST /api/custom-orders`: inspiration, bakingInstructions, weight, eggless, deliveryDate, optional referenceKey, customer, idempotencyKey. Starts at `quote_requested`; totals remain zero until an owner quotation.
- `POST /api/uploads`: authenticated multipart `file`, maximum 5 MB JPEG/PNG/WebP. MIME and magic-byte validation reject SVG/HTML. Returns a private referenceKey.
- `GET /api/uploads/<encoded-key>`: only the uploading customer or configured owner may read the reference.
- `GET/PUT /api/admin`: owner-only catalog/settings/categories and latest 50 orders. Sending a products array replaces the catalog; omitted IDs are removed. Deleting catalog rows retains historical order item snapshots. GET supports the composite `cursor` and legacy `before` pagination parameters.
- `PATCH /api/admin/orders`: orderId, status, optional custom `quoteTotal` in INR. Final delivered/cancelled statuses cannot be reopened.

All writes require a same-origin browser request and enforce validated, bounded payloads. Customer identity is never accepted from the body. SQL statements use bound parameters. Writes are limited using durable SQL atomic counters, including an hourly upload limit. Delivery dates follow Asia/Kolkata and need two days' notice. References are inaccessible to other accounts. Rich-text inspiration is stored and rendered as plain text, never executable HTML. Idempotency is enforced by a unique `(user_id, idempotency_key)` database index; repeated or simultaneous submissions return the existing order.

## Capacity and verification

The design supports more than 1,000 registered accounts without a process-local session store, cart store or order store. Static images and app assets are cacheable at the edge; dynamic identity and checkout are bounded requests. Durable indexes and batched item queries keep history queries bounded to 30–100 orders rather than scanning all customers. This is an architectural capacity target, not a claim that 1,000 simultaneous purchases were load tested. Before a busy public launch, select an appropriate Cloudflare service plan, perform a realistic concurrent checkout load test, and monitor SQL latency and worker errors. Split databases or migrate the write path if measured concurrency exceeds the chosen D1 database's write throughput.

Run meaningful validation and security tests with:

```powershell
node --experimental-strip-types --test tests/backend.test.mjs
```

The tests cover inventory completeness, forged prices, size calculations, sold-out products, Bangalore date boundaries, payload limits, fail-closed owner access, origin checks, upload signatures and safe custom descriptions. SQLite migration tests verify idempotency, guarded checkout rollback, durable rate counters, same-price category changes, tied-timestamp pagination and preservation of a concurrent quote during a status-only update. Local end-to-end checks also confirm actual D1 persistence, denied owner access, an owner price edit visible in the catalog and idempotent checkout submissions.

With a migrated local preview at `http://127.0.0.1:5173` and the development identity explicitly configured as owner, run `node --experimental-strip-types tests/local-api.integration.mjs`. This script refuses production targets by using a fixed loopback URL. It verifies actual D1/R2 requests, identity-header forgery rejection, same-origin checks, stale-price rejection, idempotency, temporary CMS price changes (restored afterwards), authenticated image retrieval, a custom quote and status update. It creates two local fixture orders and cancels them before finishing. These local integration checks passed during development; no production test orders were created.
