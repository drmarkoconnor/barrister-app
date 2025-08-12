// functions/api-attendance-notes.js
// ESM Netlify Function: GET (read/list), POST (create), PATCH (update/status/archive)
// DB columns expected: archived (bool), lawyer_name (text), court_date NOT NULL (defaulted here if missing)

import { supabaseAdmin, ownerId } from './util/supabase.js'

function json(status, obj) {
	return {
		statusCode: status,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(obj),
	}
}
function safeParse(s) {
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

		// ---------- GET ----------
		if (event.httpMethod === 'GET') {
			const raw =
				event.rawUrl ||
				`http://local${event.path}${
					event.queryStringParameters
						? '?' + new URLSearchParams(event.queryStringParameters)
						: ''
				}`
			const url = new URL(raw)

			const id = url.searchParams.get('id')
			const status = url.searchParams.get('status')
			const archivedParam = (
				url.searchParams.get('archived') || ''
			).toLowerCase()
			const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)

			if (id) {
				const { data, error } = await supabase
					.from('attendance_notes')
					.select('*')
					.eq('owner_id', OWN)
					.eq('id', id)
					.single()
				if (error)
					return json(404, {
						error: 'Not found',
						code: error.code,
						details: error.message,
					})

				// Optionally include expenses for this note
				let expenses = []
				const inclEx =
					(url.searchParams.get('include_expenses') || '').trim() === '1'
				if (inclEx) {
					const { data: ex } = await supabase
						.from('attendance_expenses')
						.select('id, expense_type, amount, created_at')
						.eq('owner_id', OWN)
						.eq('attendance_note_id', id)
						.order('created_at', { ascending: true })
					expenses = Array.isArray(ex) ? ex : []
				}

				return json(200, { item: data, expenses })
			}

			let q = supabase
				.from('attendance_notes')
				.select('*')
				.eq('owner_id', OWN)
				.order('created_at', { ascending: false })
				.limit(limit)

			if (status) q = q.eq('status', status)
			if (archivedParam === '1' || archivedParam === 'true') {
				q = q.eq('archived', true)
			} else if (archivedParam === 'all') {
				// no filter
			} else {
				q = q.eq('archived', false) // default active only
			}

			const { data, error } = await q
			if (error)
				return json(500, {
					error: 'List failed',
					code: error.code,
					details: error.message,
				})
			return json(200, { items: data, count: data?.length || 0 })
		}

		// ---------- POST (create) ----------
		if (event.httpMethod === 'POST') {
			const body = safeParse(event.body)
			if (!body) return json(400, { error: 'Invalid JSON' })

			const client_first_name = (body.client_first_name || '').trim()
			const client_last_name = (body.client_last_name || '').trim()
			if (!client_first_name || !client_last_name) {
				return json(400, {
					error: 'client_first_name and client_last_name are required',
				})
			}

			const row = {
				owner_id: OWN,
				client_first_name,
				client_last_name,
				court_date:
					(body.court_date && String(body.court_date)) ||
					new Date().toISOString().slice(0, 10),
				next_steps_date:
					body.next_steps_date || body.next_appearance_date || null,
				court_name: body.court_name || null,
				law_firm: body.law_firm || null,
				lawyer_name: body.lawyer_name || null,
				hearing_type: body.hearing_type || null,
				coram: body.coram || null,
				contra: body.contra || null,
				outcome: body.outcome || null,
				remand: body.remand || null,
				advice_text: body.advice_text || '',
				closing_text: body.closing_text || '',
				status: body.status || 'draft',
				archived: false,
			}

			const { data, error } = await supabase
				.from('attendance_notes')
				.insert([row])
				.select('id')
				.single()

			if (error) {
				console.error('Create attendance note error', error)
				return json(500, {
					error: 'Create failed',
					code: error.code,
					details: error.message,
				})
			}
			// Optional: insert expenses
			try {
				const exps = Array.isArray(body.expenses) ? body.expenses : []
				const rows = exps
					.map((e) => ({
						owner_id: OWN,
						attendance_note_id: data.id,
						expense_type: String(e?.type || '')
							.trim()
							.slice(0, 120),
						amount: Number(e?.amount) || 0,
					}))
					.filter((r) => r.expense_type && r.amount > 0)
				if (rows.length) {
					const { error: exErr } = await supabase
						.from('attendance_expenses')
						.insert(rows)
					if (exErr) console.error('Insert expenses failed', exErr)
				}
			} catch (e) {
				console.error('Expense insert error', e)
			}
			return json(200, { id: data.id })
		}

		// ---------- PATCH (update / status / archive) ----------
		if (event.httpMethod === 'PATCH') {
			const body = safeParse(event.body)
			if (!body || !body.id) return json(400, { error: 'id is required' })

			if (body.action === 'status') {
				const next = String(body.status || '').trim()
				if (!['draft', 'final', 'sent'].includes(next)) {
					return json(400, { error: 'Invalid status' })
				}
				const { error } = await supabase
					.from('attendance_notes')
					.update({ status: next })
					.eq('owner_id', OWN)
					.eq('id', body.id)
				if (error)
					return json(500, {
						error: 'Status update failed',
						code: error.code,
						details: error.message,
					})
				return json(200, { ok: true })
			}

			if (body.action === 'archive') {
				const { error } = await supabase
					.from('attendance_notes')
					.update({ archived: true })
					.eq('owner_id', OWN)
					.eq('id', body.id)
				if (error)
					return json(500, {
						error: 'Archive failed',
						code: error.code,
						details: error.message,
					})
				return json(200, { ok: true })
			}

			const up = { ...body }
			delete up.id
			delete up.action
			// Remove non-column props
			delete up.expenses
			// Back-compat: if client sent next_appearance_date, map to next_steps_date
			if (
				!Object.prototype.hasOwnProperty.call(up, 'next_steps_date') &&
				Object.prototype.hasOwnProperty.call(up, 'next_appearance_date')
			) {
				up.next_steps_date = up.next_appearance_date
				delete up.next_appearance_date
			}
			const { error } = await supabase
				.from('attendance_notes')
				.update(up)
				.eq('owner_id', OWN)
				.eq('id', body.id)
			if (error)
				return json(500, {
					error: 'Update failed',
					code: error.code,
					details: error.message,
				})

			// Replace expenses if provided
			if (Object.prototype.hasOwnProperty.call(body, 'expenses')) {
				const exps = Array.isArray(body.expenses) ? body.expenses : []
				// delete existing for this note
				const { error: delErr } = await supabase
					.from('attendance_expenses')
					.delete()
					.eq('owner_id', OWN)
					.eq('attendance_note_id', body.id)
				if (delErr) console.error('Delete expenses failed', delErr)
				const rows = exps
					.map((e) => ({
						owner_id: OWN,
						attendance_note_id: body.id,
						expense_type: String(e?.type || '')
							.trim()
							.slice(0, 120),
						amount: Number(e?.amount) || 0,
					}))
					.filter((r) => r.expense_type && r.amount > 0)
				if (rows.length) {
					const { error: exErr } = await supabase
						.from('attendance_expenses')
						.insert(rows)
					if (exErr) console.error('Insert expenses failed', exErr)
				}
			}
			return json(200, { ok: true })
		}

		return json(405, { error: 'Method not allowed' })
	} catch (e) {
		console.error('api-attendance-notes error', e)
		return json(500, { error: 'Internal error', details: e.message })
	}
}

