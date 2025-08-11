// functions/api-todos.mjs
// GET:    /.netlify/functions/api-todos?limit=50&status=open|done|all
// POST:   /.netlify/functions/api-todos   { title, due_at? }
// PATCH:  /.netlify/functions/api-todos   { id, status?, title?, due_at? }
// DELETE: /.netlify/functions/api-todos?id=<uuid>

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
			const status = (url.searchParams.get('status') || 'open').toLowerCase()
			const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)

			let query = supabase
				.from('todos')
				.select('*')
				.eq('owner_id', OWN)
				.order('created_at', { ascending: false })
				.limit(limit)
			if (status !== 'all') query = query.eq('status', status)

			const { data, error } = await query
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
			const title = (body?.title || '').trim()
			const due_at = body?.due_at || null
			if (!title) return json(400, { error: 'title is required' })

			const { data, error } = await supabase
				.from('todos')
				.insert([
					{
						owner_id: OWN,
						title,
						due_at,
						status: 'open',
						source: 'manual',
						case_id: null,
					},
				])
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

		if (event.httpMethod === 'PATCH') {
			const body = parse(event.body)
			const id = (body?.id || '').trim()
			if (!id) return json(400, { error: 'id is required' })

			const patch = {}
			if (typeof body.title === 'string') patch.title = body.title.trim()
			if (typeof body.status === 'string')
				patch.status = body.status.trim().toLowerCase()
			if (Object.prototype.hasOwnProperty.call(body, 'due_at'))
				patch.due_at = body.due_at ?? null

			if (!Object.keys(patch).length)
				return json(400, { error: 'no fields to update' })

			const { error } = await supabase
				.from('todos')
				.update(patch)
				.eq('owner_id', OWN)
				.eq('id', id)
			if (error)
				return json(500, {
					error: 'Update failed',
					code: error.code,
					details: error.message,
				})
			return json(200, { ok: true })
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
				.from('todos')
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
		console.error('api-todos error', e)
		return json(500, { error: 'Internal error', details: e.message })
	}
}

