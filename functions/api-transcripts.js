// functions/api-transcripts.js
// GET:  /.netlify/functions/api-transcripts?limit=50
// POST: /.netlify/functions/api-transcripts  { text, provider?, confidence?, duration_seconds? }
// DELETE: /.netlify/functions/api-transcripts?id=<uuid>

import { supabaseAdmin, ownerId } from './util/supabase.js'

const json = (s, o) => ({
	statusCode: s,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(o),
})
const parse = (s) => {
	try {
		return JSON.parse(s || '{}')
	} catch {
		return null
	}
}

export const handler = async (event) => {
	try {
		const supabase = supabaseAdmin()
		const OWN = ownerId()

		if (event.httpMethod === 'GET') {
			const raw =
				event.rawUrl ||
				`http://local${event.path}${
					event.queryStringParameters
						? '?' + new URLSearchParams(event.queryStringParameters)
						: ''
				}`
			const url = new URL(raw)
			const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)

			const { data, error } = await supabase
				.from('transcripts')
				.select('*')
				.eq('owner_id', OWN)
				.order('created_at', { ascending: false })
				.limit(limit)

			if (error)
				return json(500, {
					error: 'List failed',
					code: error.code,
					details: error.message,
				})
			return json(200, { items: data || [], count: data?.length || 0 })
		}

		if (event.httpMethod === 'POST') {
			const body = parse(event.body)
			const text = (body?.text || '').trim()
			if (!text) return json(400, { error: 'text is required' })

			const row = {
				owner_id: OWN,
				text,
				provider: body?.provider || 'openai-whisper',
				confidence: Number.isFinite(body?.confidence)
					? Number(body.confidence)
					: null,
				duration_seconds: Number.isFinite(body?.duration_seconds)
					? Number(body.duration_seconds)
					: null,
			}

			const { data, error } = await supabase
				.from('transcripts')
				.insert([row])
				.select('id')
				.single()

			if (error)
				return json(500, {
					error: 'Create failed',
					code: error.code,
					details: error.message,
				})
			return json(200, { id: data.id })
		}

		if (event.httpMethod === 'DELETE') {
			const raw =
				event.rawUrl ||
				`http://local${event.path}${
					event.queryStringParameters
						? '?' + new URLSearchParams(event.queryStringParameters)
						: ''
				}`
			const url = new URL(raw)
			const id = (url.searchParams.get('id') || '').trim()
			if (!id) return json(400, { error: 'id is required' })

			const { error } = await supabase
				.from('transcripts')
				.delete()
				.eq('owner_id', OWN)
				.eq('id', id)

			if (error)
				return json(500, {
					error: 'Delete failed',
					code: error.code,
					details: error.message,
				})
			return json(200, { ok: true })
		}

		return json(405, { error: 'Method not allowed' })
	} catch (e) {
		console.error('api-transcripts error', e)
		return json(500, { error: 'Internal error', details: e.message })
	}
}

