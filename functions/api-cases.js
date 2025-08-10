// functions/api-cases.js
// Create/list cases for the single-owner app.
// POST JSON: { case_ref, client_name, court, hearing_date, result, notes }
// GET  : returns last 10 cases (owner-scoped)
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
		const supabase = supabaseAdmin()
		const OWN = ownerId()

		if (event.httpMethod === 'POST') {
			const body = JSON.parse(event.body || '{}')

			// Basic validation
			const case_ref = (body.case_ref || '').trim()
			const client_name = (body.client_name || '').trim()
			const court = (body.court || '').trim()
			const hearing_date = (body.hearing_date || '').trim() || null // "YYYY-MM-DD" or null
			const result = (body.result || '').trim() || null
			const notes = (body.notes || '').trim() || null

			if (!case_ref || !client_name) {
				return json(400, { error: 'case_ref and client_name are required' })
			}

			// Insert
			const { data, error } = await supabase
				.from('cases')
				.insert([
					{
						owner_id: OWN,
						case_ref,
						client_name,
						court,
						hearing_date,
						result,
						notes,
					},
				])
				.select()
				.single()

			if (error) {
				console.error('api-cases insert error', error)
				return json(500, {
					error: 'Failed to create case',
					details: error.message,
				})
			}
			return json(200, { ok: true, case: data })
		}

		if (event.httpMethod === 'GET') {
			const { data, error } = await supabase
				.from('cases')
				.select(
					'id, case_ref, client_name, court, hearing_date, result, created_at'
				)
				.eq('owner_id', OWN)
				.order('created_at', { ascending: false })
				.limit(10)

			if (error) {
				console.error('api-cases list error', error)
				return json(500, { error: 'Failed to load cases' })
			}
			return json(200, { items: data })
		}

		return json(405, { error: 'Method not allowed' })
	} catch (err) {
		console.error('api-cases fatal', err)
		return json(500, { error: 'Internal error in api-cases' })
	}
}

