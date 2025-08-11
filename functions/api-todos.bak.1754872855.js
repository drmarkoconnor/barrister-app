// functions/api-todos.js
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// Admin client for RLS bypass
const supabase = createClient(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
	try {
		if (event.httpMethod !== 'GET') {
			return json(405, { error: 'Method not allowed' })
		}

		const limit = parseInt(event.queryStringParameters.limit || '10', 10)
		const status = event.queryStringParameters.status || 'open'
		const ownerId = process.env.SUPABASE_OWNER_ID

		if (!ownerId) {
			return json(500, { error: 'SUPABASE_OWNER_ID not configured' })
		}

		const { data, error } = await supabase
			.from('todos')
			.select('*')
			.eq('owner_id', ownerId)
			.eq('status', status)
			.order('created_at', { ascending: false })
			.limit(limit)

		if (error) {
			console.error('Supabase error in api-todos', error)
			return json(500, { error: error.message })
		}

		return json(200, { items: data })
	} catch (err) {
		console.error('api-todos error', err)
		return json(500, { error: 'Internal error in api-todos' })
	}
}

function json(status, obj) {
	return {
		statusCode: status,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(obj),
	}
}

