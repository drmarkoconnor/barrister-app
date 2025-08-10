import 'dotenv/config'
import OpenAI from 'openai'
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
function buildPrompt(transcript) {
	return `
You will read a barrister's spoken note and return STRICT JSON with two keys:

{
  "summary": "1–3 sentence plain-English summary of the note",
  "todos": [
    { "title": "Short actionable todo", "due_at": "YYYY-MM-DD or null" }
  ]
}

Rules:
- Use concise UK legal tone.
- If dates like "next Friday" are present, convert to YYYY-MM-DD if you can infer (else null).
- Keep todos action-focused (call, email, file, draft, review, confirm, schedule).
- No extra keys. No commentary. JSON ONLY.

TRANSCRIPT:
---
${transcript}
---
`.trim()
}

export const handler = async (event) => {
	try {
		if (event.httpMethod !== 'POST') {
			return json(405, { error: 'Method not allowed' })
		}
		const apiKey = process.env.OPENAI_API_KEY
		if (!apiKey) return json(500, { error: 'OPENAI_API_KEY not configured' })

		const body = safeParse(event.body)
		if (
			!body ||
			typeof body.transcript !== 'string' ||
			body.transcript.trim().length < 5
		) {
			return json(400, {
				error: 'transcript (string) is required and should be at least 5 chars',
			})
		}

		const transcriptText = body.transcript.trim()
		const confidence = Number.isFinite(body.confidence)
			? Number(body.confidence)
			: null
		const durationSeconds = Number.isInteger(body.durationSeconds)
			? body.durationSeconds
			: null

		// 1) Save transcript first
		const supabase = supabaseAdmin()
		const OWN = ownerId()

		const { data: insertedTranscript, error: tErr } = await supabase
			.from('transcripts')
			.insert([
				{
					owner_id: OWN,
					text: transcriptText,
					provider: 'openai-whisper',
					confidence,
					duration_seconds: durationSeconds,
				},
			])
			.select()
			.single()

		if (tErr) {
			console.error('Insert transcript error', tErr)
			return json(500, { error: 'Failed to save transcript' })
		}

		// 2) Summarise + produce todos using gpt-5-nano (no temperature param)
		const openai = new OpenAI({ apiKey })
		const prompt = buildPrompt(transcriptText)

		// Try strict JSON response_format; if the model rejects, fall back to plain text and parse.
		let parsed = null
		try {
			const completion = await openai.chat.completions.create({
				model: 'gpt-5-nano',
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: 'You output strict JSON only.' },
					{ role: 'user', content: prompt },
				],
			})
			const raw = completion.choices?.[0]?.message?.content || '{}'
			parsed = JSON.parse(raw)
		} catch (e) {
			// Fallback: ask again without response_format and then JSON.parse
			try {
				const completion = await openai.chat.completions.create({
					model: 'gpt-5-nano',
					messages: [
						{ role: 'system', content: 'You output strict JSON only.' },
						{ role: 'user', content: prompt },
					],
				})
				const raw = completion.choices?.[0]?.message?.content || '{}'
				parsed = JSON.parse(raw)
			} catch (e2) {
				console.error('OpenAI summarise error', e2)
				return json(502, { error: 'OpenAI summarisation failed' })
			}
		}

		const summary = typeof parsed?.summary === 'string' ? parsed.summary : ''
		const todos = Array.isArray(parsed?.todos) ? parsed.todos : []

		// 3) Insert todos (best-effort; skip invalids)
		const rows = []
		for (const t of todos) {
			if (!t || typeof t.title !== 'string' || !t.title.trim()) continue
			rows.push({
				owner_id: OWN,
				title: t.title.trim(),
				due_at:
					t.due_at && String(t.due_at).match(/^\d{4}-\d{2}-\d{2}$/)
						? t.due_at
						: null,
				status: 'open',
				source: 'transcript',
				case_id: null,
			})
		}

		if (rows.length) {
			const { error: todoErr } = await supabase.from('todos').insert(rows)
			if (todoErr) console.error('Insert todos error', todoErr)
		}

		return json(200, {
			summary,
			todos,
			todosCount: rows.length,
			transcriptId: insertedTranscript.id,
		})
	} catch (err) {
		console.error(err)
		return json(500, { error: 'Internal error in api-summarise' })
	}
}

