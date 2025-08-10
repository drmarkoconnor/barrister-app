import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'
import os from 'os'
import path from 'path'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const handler = async (event) => {
	try {
		if (event.httpMethod !== 'POST') {
			return json(405, { error: 'Method not allowed' })
		}

		const { audioWebmBase64 } = JSON.parse(event.body || '{}')
		if (!audioWebmBase64) {
			return json(400, { error: 'audioWebmBase64 is required' })
		}

		const base64Data = audioWebmBase64.includes(',')
			? audioWebmBase64.split(',')[1]
			: audioWebmBase64
		const buffer = Buffer.from(base64Data, 'base64')

		const tmp = path.join(os.tmpdir(), `note-${Date.now()}.webm`)
		fs.writeFileSync(tmp, buffer)

		const resp = await openai.audio.transcriptions.create({
			file: fs.createReadStream(tmp),
			model: 'whisper-1',
		})

		fs.unlinkSync(tmp)

		return json(200, { transcript: resp.text || '' })
	} catch (err) {
		console.error('api-transcribe error', err)
		return json(500, { error: err.message })
	}
}

function json(status, obj) {
	return {
		statusCode: status,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(obj),
	}
}

