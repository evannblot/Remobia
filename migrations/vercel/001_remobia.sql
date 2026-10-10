BEGIN;
CREATE TABLE IF NOT EXISTS phone_listings (
 id text PRIMARY KEY, brand text NOT NULL, model text NOT NULL,
 storage text NOT NULL DEFAULT '', color text NOT NULL DEFAULT '',
 condition text NOT NULL CHECK (condition IN ('excellent','good','fair')),
 price_cents integer NOT NULL CHECK (price_cents BETWEEN 1 AND 1000000),
 battery integer CHECK (battery BETWEEN 0 AND 100), description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','sold')),
 created_at text NOT NULL, updated_at text NOT NULL,
 version integer NOT NULL DEFAULT 1, write_token text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS phone_listings_status_updated_idx ON phone_listings(status,updated_at);
CREATE TABLE IF NOT EXISTS phone_images (
 id text PRIMARY KEY, phone_id text NOT NULL REFERENCES phone_listings(id) ON DELETE CASCADE,
 object_key text NOT NULL UNIQUE, mime_type text NOT NULL, position integer NOT NULL
);
CREATE INDEX IF NOT EXISTS phone_images_phone_idx ON phone_images(phone_id);
CREATE TABLE IF NOT EXISTS trade_in_requests (
 id text PRIMARY KEY, request_id text NOT NULL UNIQUE, reference text NOT NULL UNIQUE,
 fingerprint text NOT NULL, details text NOT NULL, created_at text NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','deleting','deleted'))
);
CREATE INDEX IF NOT EXISTS trade_in_requests_state_created_idx ON trade_in_requests(state,created_at);
CREATE TABLE IF NOT EXISTS trade_in_images (
 id text PRIMARY KEY, request_id text NOT NULL REFERENCES trade_in_requests(id) ON DELETE CASCADE,
 object_key text NOT NULL UNIQUE, mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 side text NOT NULL CHECK (side IN ('front','back','additional1','additional2')),
 UNIQUE(request_id,side)
);
CREATE INDEX IF NOT EXISTS trade_in_images_request_idx ON trade_in_images(request_id);
CREATE TABLE IF NOT EXISTS notification_outbox (
 id text PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('trade-in')),
 resource_id text NOT NULL REFERENCES trade_in_requests(id) ON DELETE CASCADE,
 created_at text NOT NULL, sent_at text, attempts integer NOT NULL DEFAULT 0
);
COMMIT;
