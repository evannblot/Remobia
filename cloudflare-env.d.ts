declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SITE_ADMIN_EMAIL?: string;
    QUOTE_TO_EMAIL?: string;
    QUOTE_FROM_EMAIL?: string;
    RESEND_API_KEY?: string;
  }
}
