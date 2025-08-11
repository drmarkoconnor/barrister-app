// Deprecated backup file. This is intentionally a stub so Netlify build succeeds.
export const handler = async () => ({
	statusCode: 410,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		error: 'Deprecated backup function. Use api-attendance-notes.js',
	}),
})

