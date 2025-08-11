// functions/api-transcripts.js
import { supabaseAdmin, ownerId } from './util/supabase.mjs'

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

		if (event.httpMethod === 'GET') {
			const { data, error } = await supabase
				.from('transcripts')
				.select('id, text, created_at')
				.eq('owner_id', OWN)
				.order('created_at', { ascending: false })
				.limit(20)
			if (error) return json(500, { error: 'Failed to load transcripts' })
			return json(200, { items: data })
		}

		if (event.httpMethod === 'DELETE') {
			const id = (
				new URLSearchParams(event.rawQuery || event.rawQueryString || '').get(
					'id'
				) || ''
			).trim()
			if (!id) return json(400, { error: 'id is required' })
			const { error } = await supabase
				.from('transcripts')
				.delete()
				.eq('id', id)
				.eq('owner_id', OWN)
			if (error) return json(500, { error: 'Failed to delete' })
			return json(200, { ok: true })
		}

		return json(405, { error: 'Method not allowed' })
	} catch (err) {
		console.error('api-transcripts fatal', err)
		return json(500, { error: 'Internal error' })
	}
}

