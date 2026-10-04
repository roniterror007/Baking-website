-- Run once in the Supabase SQL editor. Clients cannot query these tables directly.
BEGIN;
CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY, rowid bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  name text NOT NULL, category text NOT NULL, collection text NOT NULL,
  description text NOT NULL, price_cents bigint NOT NULL CHECK (price_cents >= 0),
  image text NOT NULL, featured integer NOT NULL DEFAULT 0, available integer NOT NULL DEFAULT 1,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products(category, available);
CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY, user_id text NOT NULL, idempotency_key text NOT NULL,
  customer_json text NOT NULL, status text NOT NULL, kind text NOT NULL,
  total_cents bigint NOT NULL CHECK (total_cents >= 0), delivery_cents bigint NOT NULL,
  payment_method text NOT NULL, custom_json text, created_at bigint NOT NULL, updated_at bigint NOT NULL,
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON public.orders(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders(status, created_at DESC);
CREATE TABLE IF NOT EXISTS public.order_items (
  id text PRIMARY KEY, rowid bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text NOT NULL, name text NOT NULL, quantity integer NOT NULL CHECK (quantity > 0),
  weight text NOT NULL, eggless integer NOT NULL, instructions text NOT NULL,
  delivery_date text NOT NULL, unit_cents bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id text PRIMARY KEY, full_name text NOT NULL, phone text NOT NULL,
  address text NOT NULL, billing_address text NOT NULL,
  saved_payment_method text NOT NULL DEFAULT 'cod', updated_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY, window_start bigint NOT NULL, count integer NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON public.rate_limits(window_start);
CREATE TABLE IF NOT EXISTS public.shop_settings (key text PRIMARY KEY, value text NOT NULL, updated_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS public.uploads (
  key text PRIMARY KEY, user_id text NOT NULL, content_type text NOT NULL,
  size integer NOT NULL, created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS uploads_user_idx ON public.uploads(user_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.products,public.orders,public.order_items,public.profiles,public.rate_limits,public.shop_settings,public.uploads FROM anon,authenticated;
REVOKE ALL ON SEQUENCE public.products_rowid_seq,public.order_items_rowid_seq FROM anon,authenticated;
-- Only server handlers use the database connection and secret storage key.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('cake-references','cake-references',false,4194304,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=4194304,allowed_mime_types=excluded.allowed_mime_types;
COMMIT;

