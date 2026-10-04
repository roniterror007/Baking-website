# Golden Delights on Vercel and Supabase

The default scripts now use standard Next.js. The storefront and local cake sequence are retained. Orders, customer profiles, rate limits, catalog, CMS settings and private reference images now use Supabase. Verified Supabase email sign-in replaces ChatGPT dispatch authentication. The existing Sites deployment is separate and has not been changed by this migration.

## Supabase setup

1. Create a dedicated Supabase project, preferably in Mumbai near Vercel's `bom1` region. Choose your own database password; do not put it in chat or source control.
2. Run [supabase/migrations/0001_bakery.sql](supabase/migrations/0001_bakery.sql) in its SQL editor. It creates seven indexed tables, denies direct anonymous/authenticated client table access, and creates the private `cake-references` bucket. All data access goes through server handlers. Running it again preserves existing rows.
3. In **Connect**, choose **Transaction pooler**, copy its actual connection URI, URL-encode any reserved characters in the password, and append `?sslmode=require`. Never construct the pooler host from a guessed project region. Use this as `DATABASE_URL`.
4. In **Settings → API keys**, copy the project URL, publishable key and server secret key (legacy `anon` / `service_role` keys also work). The secret key and database connection belong only in private environment variables. Never use a `NEXT_PUBLIC_` prefix for either secret.
5. Enable email authentication. After obtaining the Vercel URL, set Supabase **Authentication → URL Configuration → Site URL** to that exact URL and allow `<site URL>/auth/callback`. For local testing allow `http://localhost:5173/auth/callback` and/or `http://127.0.0.1:5173/auth/callback`. For previews, allow only the specific previews that need authentication.
6. Configure your production SMTP sender before customer launch. Supabase's built-in sender only delivers to organization members and is limited to two messages/hour. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp). Keep the standard magic-link email template containing `{{ .ConfirmationURL }}`. Links must be opened in the browser where sign-in was requested.

## Vercel setup

Import this repository at [Vercel New Project](https://vercel.com/new), with **Root Directory `crumb-and-craft`** when importing the parent repository, or `.` when this checkout is the repository root. Framework: **Next.js**. Install: `npm ci`. Build: `npm run build`. Leave Output Directory at the Next.js default; do not use `dist` or a static export. `vercel.json` already selects Mumbai for server functions.

Configure the names in [.env.example](.env.example) for Production and the intended Preview environment:

| Variable | Source |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler connection |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable/legacy anon key |
| `SUPABASE_SECRET_KEY` | Server secret/legacy service-role key |
| `SUPABASE_STORAGE_BUCKET` | `cake-references` |
| `OWNER_EMAIL` | `ronittd2005@gmail.com` |

The two public Supabase variables are embedded during the build. Redeploy after adding or changing them. A verified owner email is required; spoofed request headers and user-editable metadata never grant ownership. If using `OWNER_USER_ID`, use the new Supabase UUID rather than the old Sites identity.

For CLI deployment from this checkout, use the official Vercel CLI after signing in:

```powershell
npx vercel login
npx vercel link
npx vercel env pull .env.local
npx vercel --prod
```

Do not publish a customer launch until database, email and storage configuration are verified. A build can succeed without credentials; unconfigured service requests fail closed instead of writing process-local data. The present Vercel/Supabase source is prepared locally; a new live Vercel URL exists only after a successful deployment.

## Validation

```powershell
npm ci
npm run typecheck
npm test
npm run test:postgres
npm run test:animation
npm run build
npm start
```

The PostgreSQL tests execute the actual migration and query adapter in PGlite (PostgreSQL), including client permission denial, catalog seeding without resetting owner prices, JSON bulk inventory changes, checkout transaction rollback, idempotency, rate limits and nullable quote updates. Existing SQLite regressions retain historical validation coverage; they do not stand in for hosted Supabase integration tests.

After connecting the actual services, verify sign-in, owner price editing, two customer accounts' isolation, a COD order, custom reference upload/download and email delivery on the deployed URL. References are limited to 4 MiB plus bounded multipart overhead so uploads/downloads fit [Vercel's 4.5 MB function payload limit](https://vercel.com/docs/functions/limitations).

The current Sites catalog (28 products, owner prices, categories and storefront settings) has been exported to `supabase/catalog-import.json`. The first request seeds this snapshot only if the new database has not been initialized; later owner changes are preserved. Changes made on the old site after this export need to be synchronized before switching customers over. Existing Sites orders, customer identities and reference uploads have not been copied. Customer data migration needs a separate reviewed mapping from Sites users to verified Supabase users; never associate customers by unverified submitted email.

The Vercel deployment is prepared for stateless handlers and bounded pooled connections (two per warm function instance). More than 1,000 registered accounts is an architectural target; 1,000 simultaneous checkouts is not certified. Select database and hosting capacity based on actual hosted load measurements.

### Owner and customer accounts

Register and verify `ronittd2005@gmail.com` for owner access. Set its password privately; do not paste it into a SQL migration, environment variable, GitHub or source file. `/sign-in` supports password sign-in, explicit account registration and an email-link fallback for existing accounts. Brownies/blondies are always eggless. Guests can browse but must create an account/sign in before adding to the bag or placing requests.

Owner CMS changes persist in PostgreSQL and are reflected by the storefront's catalog refresh. No GitHub redeployment is needed for pricing, availability, collections, banner text or product-grid column changes.
