// functions/api-attendance-notes.js
import 'dotenv/config'
import { supabaseAdmin, ownerId } from './util/supabase.js'

function json(status, obj) {
	return {
		statusCode: status,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(obj),
	}
}

export const handler = async (event) => {
	try {
		if (event.httpMethod !== 'GET') {
			return json(405, { error: 'Method not allowed (GET only in Step 1)' })
		}

		const supabase = supabaseAdmin()
		const OWN = ownerId()
		const qs = event.queryStringParameters || {}
		const id = (qs.id || '').trim()
		const archived = String(qs.archived || '') === '1'

		if (id) {
			const { data, error } = await supabase
				.from('attendance_notes')
				.select('*')
				.eq('owner_id', OWN)
				.eq('id', id)
				.single()
			if (error || !data) return json(404, { error: 'Not found' })
			return json(200, { item: data })
		}

		const { data, error } = await supabase
			.from('attendance_notes')
			.select(
				'id, client_first_name, client_last_name, court_date, next_appearance_date, court_name, status, archived, created_at'
			)
			.eq('owner_id', OWN)
			.eq('archived', archived)
			.order('next_appearance_date', { ascending: true, nullsFirst: false })
			.order('created_at', { ascending: false })
			.limit(100)

		if (error) return json(500, { error: 'Failed to load notes' })
		return json(200, { items: data })
	} catch (err) {
		console.error('api-attendance-notes (GET) fatal', err)
		return json(500, { error: 'Internal error' })
	}
}

