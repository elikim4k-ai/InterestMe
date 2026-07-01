/**
 * Client-safe feature flags. Driven by NEXT_PUBLIC_* env vars so they can be
 * toggled per-environment in Vercel without a code change.
 */

/**
 * Social/OAuth login (Google, etc.). Off until the providers are configured in
 * Supabase. Set NEXT_PUBLIC_OAUTH_ENABLED=true in the environment to re-enable.
 */
export const OAUTH_ENABLED = process.env.NEXT_PUBLIC_OAUTH_ENABLED === "true"
