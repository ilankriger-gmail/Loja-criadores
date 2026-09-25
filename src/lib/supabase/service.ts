import { createClient } from '@supabase/supabase-js';

/**
 * Service client — bypasses RLS, use only on server-side API routes.
 * For reading metrics_snapshots, creator_posts, and other tables
 * where RLS policies may not include user_id-based SELECT.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
