// ESM Netlify Function: manage directory lists (GET list, POST add, DELETE remove)
// Types supported: judges, lawyers, law_firms, courtrooms, contra, hearing_types

import { supabaseAdmin, ownerId } from './util/supabase.js'
import fs from 'node:fs'
import path from 'node:path'

const TYPES = new Set([
	'judges',
	'lawyers',
	'law_firms',
	'courtrooms',
	'contra',
	'hearing_types',
])

const json = (s, o) => ({
	statusCode: s,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(o),
})

// Seeds disabled: we now start lists blank so users add their own.
function readStatic(type) {
	return []
}

export const handler = async (event) => {
	try {
		const supabase = supabaseAdmin()
		const OWN = ownerId()

		const raw =
			event.rawUrl ||
			`http://local${event.path}${
				event.queryStringParameters
					? '?' + new URLSearchParams(event.queryStringParameters)
					: ''
			}`
		const url = new URL(raw)
		const type = (url.searchParams.get('type') || '').trim()
		if (!TYPES.has(type)) return json(400, { error: 'Invalid or missing type' })

		if (event.httpMethod === 'GET') {
			const { data, error } = await supabase
				.from('directory_items')
				.select('value')
				.eq('owner_id', OWN)
				.eq('type', type)
				.order('value', { ascending: true })
			if (error)
				return json(500, { error: 'List failed', details: error.message })
			const items = Array.isArray(data)
				? data.map((r) => String(r.value || '').trim()).filter(Boolean)
				: []
			return json(200, { items })
		}

		const body = (() => {
			try {
				return JSON.parse(event.body || '{}')
			} catch {
				return null
			}
		})()
		if (!body) return json(400, { error: 'Invalid JSON body' })
		const value = String(body.value || '').trim()
		if (!value) return json(400, { error: 'value is required' })

		if (event.httpMethod === 'POST') {
			const { data: exists } = await supabase
				.from('directory_items')
				.select('id')
				.eq('owner_id', OWN)
				.eq('type', type)
				.eq('value', value)
				.maybeSingle()

			if (exists && (exists.id || exists.length)) return json(200, { ok: true })

			const { error } = await supabase
				.from('directory_items')
				.insert([{ owner_id: OWN, type, value }])
			if (error)
				return json(500, { error: 'Insert failed', details: error.message })
			return json(200, { ok: true })
		}

		if (event.httpMethod === 'DELETE') {
			const { error } = await supabase
				.from('directory_items')
				.delete()
				.eq('owner_id', OWN)
				.eq('type', type)
				.eq('value', value)
			if (error)
				return json(500, { error: 'Delete failed', details: error.message })
			return json(200, { ok: true })
		}

		return json(405, { error: 'Method not allowed' })
	} catch (e) {
		console.error('api-directory error', e)
		return json(500, { error: 'Internal error', details: e.message })
	}
}

