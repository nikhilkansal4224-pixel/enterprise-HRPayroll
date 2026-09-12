import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. See .env.example."
  );
}

/**
 * Service-role Supabase client. This BYPASSES Row-Level Security, so it must
 * only ever be used on the backend, after the request has been authenticated
 * and authorized in the `auth` plugin (see src/plugins/auth.ts).
 *
 * Use this for:
 *  - Verifying user JWTs (auth.getUser)
 *  - Generating signed upload URLs for the expense-proofs storage bucket
 *  - Any privileged write that legitimately needs to cross tenant/user boundaries
 *    (e.g. payroll batch generation triggered by an HR manager)
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
