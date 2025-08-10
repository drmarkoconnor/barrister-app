// functions/api-polish-advice.js
import 'dotenv/config'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

		const { text } = JSON.parse(event.body || '{}')
		if (!text || String(text).trim().length < 5)
			return json(400, { error: 'text is required' })

		// Use a small, cheap model; leave temperature default (some models reject custom temps)
		const resp = await openai.chat.completions.create({
			model: 'gpt-5-nano',
			messages: [
				{
					role: 'system',
					content:
						'Rewrite this legal attendance note advice in clear, concise, professional British English. Keep the meaning; do not invent facts.',
				},
				{ role: 'user', content: String(text) },
			],
		})

		const polished = resp.choices?.[0]?.message?.content?.trim() || String(text)
		return json(200, { polished })
	} catch (err) {
		console.error('api-polish-advice error', err)
		return json(500, { error: err.message || 'Internal error' })
	}
}

