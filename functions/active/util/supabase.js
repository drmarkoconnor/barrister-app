/**
 * Supabase server-side client wrapper (active bundle)
 */
import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin() {
	const url = process.env.SUPABASE_URL
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY
	if (!url || !key)
		throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
	return createClient(url, key, { auth: { persistSession: false } })
}

export function ownerId() {
	const id = process.env.SUPABASE_OWNER_ID
	if (!id) throw new Error('Missing SUPABASE_OWNER_ID in environment')
	return id
}

