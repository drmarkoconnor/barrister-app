export const handler = async () => ({
	statusCode: 501,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ error: 'Not implemented yet' }),
})

