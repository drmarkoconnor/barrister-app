// Recorder.js — streams audio to WS endpoint
let ws
let mediaRecorder

async function startRecording() {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
	ws = new WebSocket(
		`wss://${window.location.host}/.netlify/functions/api-transcribe-stream`
	)

	ws.onmessage = (event) => {
		document.getElementById('transcript').textContent += event.data + ' '
	}

	mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
	mediaRecorder.ondataavailable = (e) => {
		if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
			ws.send(e.data)
		}
	}
	mediaRecorder.start(500) // send every 0.5s
}

function stopRecording() {
	mediaRecorder.stop()
	ws.close()
}

window.startRecording = startRecording
window.stopRecording = stopRecording

