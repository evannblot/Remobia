import type { CatalogBindings } from "./catalog-server";
import type { QuoteEnvironment } from "./quotes";
import { createVercelDatabase } from "./vercel-database";
import { createVercelBucket } from "./vercel-blob";

/** Private Node runtime resources. Never expose these environment values to clients. */
export const env: CatalogBindings & QuoteEnvironment = {
  EMAIL_DELIVERY_ENABLED: process.env.EMAIL_DELIVERY_ENABLED === "true",
  DB: process.env.DATABASE_URL ? createVercelDatabase(process.env.DATABASE_URL) : undefined,
  BUCKET: process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN ? createVercelBucket() : undefined,
  SITE_ADMIN_EMAIL: process.env.SITE_ADMIN_EMAIL,
  TRADE_IN_NOTIFICATIONS_ENABLED: true,
  QUOTE_TO_EMAIL: process.env.QUOTE_TO_EMAIL,
  QUOTE_FROM_EMAIL: process.env.QUOTE_FROM_EMAIL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
};
