import type { CatalogBindings } from "./catalog-server";
import type { QuoteEnvironment } from "./quotes";

/** Node runtime configuration. Cloudflare resources and gateway identity are
 * deliberately absent: they are not available or trusted on Vercel. */
export const env: CatalogBindings & QuoteEnvironment = {
  QUOTE_TO_EMAIL: process.env.QUOTE_TO_EMAIL,
  QUOTE_FROM_EMAIL: process.env.QUOTE_FROM_EMAIL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
};
