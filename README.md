# Golden Delights

A responsive bakery storefront for Bangalore. The current source targets standard Next.js on Vercel, with Supabase PostgreSQL for orders, profiles, catalog and CMS settings, Supabase verified email authentication, and private Supabase Storage for reference images. See [VERCEL.md](VERCEL.md) for the deployment, environment variables and migration. The previously published Sites deployment remains separate.

## What's included

- Light/dark themes, sticky navigation, accessible left drawer, searchable menu and collection/price filters.
- All 27 specifically requested products, plus an editable Rasmalai example in the dedicated Mithai collection.
- A cinematic scroll sequence rendered from an artist-authored ivory celebration cake, with champagne-gold details and connected camera and decoration assembly. The official Sketchfab Viewer API exports native 3840×2160 image buffers. Source textures have been verified at a maximum of 2048×2048; these are 4K-sized renders of a 2K-textured model.
- A custom interlaced GD monogram, centered wordmark, 28 distinct flavour compositions and a bespoke cake sketch. Shared product-image viewports also work in the bag, product panels and owner inventory without changing saved prices or owner-selected photos.
- Responsive framing for laptops and small phones, with local canvas playback and a still fallback for reduced motion or loading failure. Local WebP variants preserve the full 16:9 source frame at 1280, 2560 and 3840 pixels wide. Customers do not load a third-party viewer. Author, model and license credit accompany the adaptation.
- Cakes offer egg or eggless; every brownie and blondie is eggless, enforced in both the interface and order API. Weight/box sizes, notes and Bangalore delivery dates are supported.
- Rich-text custom cake briefs, private reference-image uploads up to 4 MiB and quote requests up to 5 kg.
- Verified customer account required before adding items; email/password registration and sign-in, optional existing-account email links, persistent device cart, three-step checkout, server-authoritative prices, address profiles and order history.
- Restricted `/admin` dashboard for products, prices, availability, collections, seasonal banners, two-to-four desktop columns, fulfilment statuses and custom quotes. Phones always use a suitable responsive grid.

## Owner workflow

Open `/admin` and sign in using the verified Supabase owner account. Register `ronittd2005@gmail.com` and confirm its email first. Set the password privately through Supabase or the signup form; no owner password is stored in the project. Configure `OWNER_EMAIL=ronittd2005@gmail.com` in Vercel; there are no owner passwords or credentials in this repository. Use **Edit & price → Save to website** to change a product. Catalog prices are stored durably and used immediately by checkout. Storefronts refresh on focus and every 30 seconds. Categories, seasonal text and grid columns are under **Your storefront**.

Initial prices are editable examples. Checkout currently accepts **pay on delivery**. No online payment is charged, and no raw card details are saved. A tokenized gateway and verified webhook integration are needed to add online payments. Supabase email links handle customer registration and authentication; configure production SMTP before customer launch.

The existing Sites review deployment remains private. Vercel has independent project/deployment access settings. Confirm final prices, delivery fees (currently ₹99/free at ₹1,500), fulfilment lead time (two days), delivery coverage and contact/policy copy before taking real orders. The current catalog/settings snapshot seeds the new database. Existing Sites customers, orders and reference uploads are not automatically migrated into Supabase.

## Local development

Node 22.13+ is required. Install the locked dependencies with `npm ci`. Configure an ignored `.env.local` using [.env.example](.env.example) and apply the Supabase migration as described in [VERCEL.md](VERCEL.md). Then run:

```powershell
npm run dev
```

Open the printed local URL (normally `http://localhost:5173`). Authentication uses your actual Supabase project and verified email; no preview identity grants ownership. The ignored legacy `.dev.vars` and old Cloudflare scripts are not used by the new Next.js runtime.

## Validation and scaling

```powershell
npm run typecheck
npm test
npm run test:postgres
npm run test:animation
npm run build
```

The 20 unit/SQL regression tests and seven PostgreSQL migration/adapter/security tests pass. The Vercel production build and TypeScript pass. The earlier local D1/R2 integration and catalog benchmark belonged to the historical Sites runtime; they do not certify hosted Supabase behavior. Actual Vercel/Supabase end-to-end checks require provisioned services and configured authentication.

The storefront flows were checked in the browser at laptop and phone sizes: distinct catalog photos, egg/weight selection, delivery date retained in the bag, and all checkout steps through review. Product/custom forms validate the visible native date at submission to prevent stale state from admitting a blank date. The new ivory sequence's 180 native renders and 540 WebP variants passed complete dimension/hash checks. First, middle and final renders in both palettes were visually inspected for intact cake/board framing, camera changes, separated decorations at frame 045 and reassembly at frame 089.

Integrated scene checks passed in a restarted browser preview at 1280 × 800, 390 × 844 and 320 × 568, with no horizontal overflow. The player selected 2560-pixel frames on the laptop and 1280-pixel frames on phones. Phone scrolling over the cake advanced the story; the middle showed separated decorations and the finale showed reassembly. Returning to the intro after frame-cache eviction painted correctly. Both themes and the pause control worked, and the finale opened the custom-order dialog with reference upload, rich-text, weight and date fields. These checks made no backend or pricing mutations. Frame rate has not been certified on physical phones, and 60 fps on every device is not guaranteed.

The player finishes downloads already in progress during scrolling and prefetches four frames in the direction of travel. Compressed storage is limited to 24 frames and 2 MiB, with six decoded images, three concurrent downloads and two decode slots. Temporary frame errors get two attempts; a later visit after a five-second cooldown can retry. The motion control pauses the opening view's automatic drift; scrolling still controls the story. `npm run test:animation` exercises the actual engine with delayed downloads and decoding, transient errors, cache eviction, theme changes and resource cleanup.

The licensed ivory model has two cake tiers merged into one body. The adaptation hides the figurine topper, changes the materials and choreographs 25 separate decoration transforms, including two icing drapes, through supported Viewer API methods before rendering the local sequence. It does not depict three internal sponge or frosting layers assembling; that requires an asset authored with separate, textured ingredients. The original model has no source animations, so the motion is our local choreography.

The architecture targets more than 1,000 registered customers: stateless handlers, verified identities, indexed bounded history queries, atomic writes and durable rate limits. **1,000 simultaneous customers or purchases has not been certified.** Vercel handlers use bounded PostgreSQL connection pools; select Supabase capacity and measure hosted checkout performance before a high-concurrency launch.

See [BACKEND.md](BACKEND.md) for API and security contracts and [ASSETS.md](ASSETS.md) for the artist model's CC BY 4.0 attribution, verified 2K textures, native 3840×2160 render provenance, retired CC0 scan, retained film licenses and image prompts. The ivory cake is illustrative CGI, and the craft photograph depicts stock footage; neither represents the owner's actual product or kitchen. Catalog photos are illustrative flavour compositions; replace them with actual bakery product photography when available.

## Account and security setup

The owner email is `ronittd2005@gmail.com` (`OWNER_EMAIL` in Vercel). Only its verified Supabase identity can use owner APIs. Optional `OWNER_USER_ID` must be the same owner account's Supabase UUID. Customer registration never grants admin access. Authentication is inactive until real Supabase environment variables and the database migration are configured; the app does not contain a seeded owner credential.

In Supabase enable email confirmation, configure production SMTP and allowed callback URLs, a minimum password length of 10, auth rate limits, and leaked-password protection where available. Password verification and hashing are handled by Supabase Auth. Use a fresh password chosen privately when provisioning the owner account.

Security controls include same-origin mutation checks, durable per-user rate limits, server-side authorization, private uploads checked by content signatures, database RLS and restricted client grants, bound SQL parameters, transactional checkout, idempotency keys, server-authoritative prices, validated local login redirects, and escaped/plain-text content. Browser headers deny framing, plugins, unauthorized form targets, and device permissions; disable MIME sniffing and constrain referrers. This CSP does not claim full script-source/XSS isolation.

The owner dashboard includes all-time order/request counts, booked order value and delivered order value across the entire database, independent of order pagination. Delivered value is not proof of payment collection; checkout currently uses pay on delivery.

## Deploy from GitHub

Import `roniterror007/Baking-website` into Vercel as a Next.js project, use repository root, then follow [VERCEL.md](VERCEL.md) to connect Supabase, run the migration and configure environment variables. Never commit `.env.local`, database credentials, service keys, account passwords or customer data.
