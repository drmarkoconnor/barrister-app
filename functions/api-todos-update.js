// functions/api-todos-update.js
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
		if (event.httpMethod !== 'POST')
			return json(405, { error: 'Method not allowed' })

		const body = JSON.parse(event.body || '{}')
		const id = (body.id || '').trim()
		const status = (body.status || '').trim()

		if (!id) return json(400, { error: 'id is required' })
		if (!['open', 'done'].includes(status))
			return json(400, { error: 'status must be "open" or "done"' })

		const supabase = supabaseAdmin()
		const OWN = ownerId()

		const { error } = await supabase
			.from('todos')
			.update({ status })
			.eq('id', id)
			.eq('owner_id', OWN)

		if (error) {
			console.error('api-todos-update update error', error)
			return json(500, { error: 'Failed to update todo' })
		}

		return json(200, { ok: true })
	} catch (err) {
		console.error('api-todos-update fatal', err)
		return json(500, { error: 'Internal error' })
	}
}

