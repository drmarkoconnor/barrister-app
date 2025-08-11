// functions/api-todos-update.js
// POST: { id, status }
import { supabaseAdmin, ownerId } from './util/supabase.js'

const json = (s, o) => ({
	statusCode: s,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(o),
})

export const handler = async (event) => {
	try {
		if (event.httpMethod !== 'POST')
			return json(405, { error: 'Method not allowed' })
		const { id, status } = JSON.parse(event.body || '{}')
		const next = String(status || '')
			.trim()
			.toLowerCase()
		if (!id || !next) return json(400, { error: 'id and status are required' })
		if (!['open', 'done'].includes(next))
			return json(400, { error: 'Invalid status' })

		const supabase = supabaseAdmin()
		const OWN = ownerId()
		const { error } = await supabase
			.from('todos')
			.update({ status: next })
			.eq('owner_id', OWN)
			.eq('id', id)

		if (error)
			return json(500, {
				error: 'Update failed',
				code: error.code,
				details: error.message,
			})
		return json(200, { ok: true })
	} catch (e) {
		console.error('api-todos-update error', e)
		return json(500, { error: 'Internal error', details: e.message })
	}
}

