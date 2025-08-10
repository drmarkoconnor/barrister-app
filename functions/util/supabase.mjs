/**
 * Supabase server-side client wrapper
 *
 * IMPORTANT:
 * - Uses the SERVICE ROLE key (bypasses RLS). Use ONLY in serverless functions.
 * - We explicitly set owner_id on every insert/update to maintain owner-only data.
 */
import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin() {
	const url = process.env.SUPABASE_URL
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY

	if (!url || !key) {
		throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
	}
	return createClient(url, key, {
		auth: { persistSession: false },
	})
}

/**
 * Convenience helper to return the fixed OWNER_ID we put in env.
 * This is the single user’s UUID from Supabase Auth.
 */
export function ownerId() {
	const id = process.env.SUPABASE_OWNER_ID
	if (!id) throw new Error('Missing SUPABASE_OWNER_ID in environment')
	return id
}

