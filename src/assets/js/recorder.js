// src/assets/js/record.js
// Plain ASCII. Handles Safari (AAC/MP4) vs Chrome (Opus/WebM), playback, and upload.

;(function () {
	// Elements
	const recBtn = document.getElementById('recBtn')
	const stopBtn = document.getElementById('stopBtn')
	const playBtn = document.getElementById('playBtn')
	const sendBtn = document.getElementById('sendBtn')
	const audioEl = document.getElementById('preview')
	const statusEl = document.getElementById('recStatus')
	const outEl = document.getElementById('recOut')

	// State
	let mediaStream = null
	let mediaRec = null
	let chunks = []
	let mimeType = null
	let blob = null
	let objectUrl = null

	function log(msg) {
		if (statusEl) statusEl.textContent = msg
	}
	function printJSON(obj) {
		outEl.textContent = JSON.stringify(obj, null, 2)
	}

	function pickMime() {
		const candidates = [
			'audio/mp4;codecs=aac', // ✅ Safari/iOS
			'audio/mpeg', // mp3 (rarely supported by MediaRecorder)
			'audio/webm;codecs=opus', // ✅ Chrome/Edge/Firefox
			'audio/webm',
		]
		for (const c of candidates) {
			if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) {
				return c
			}
		}
		// Let browser pick if none explicitly supported
		return ''
	}

	async function start() {
		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				log('getUserMedia not supported in this browser')
				return
			}
			mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
			mimeType = pickMime()
			chunks = []
			mediaRec = new MediaRecorder(
				mediaStream,
				mimeType ? { mimeType } : undefined
			)
			mediaRec.ondataavailable = (e) => {
				if (e.data && e.data.size) chunks.push(e.data)
			}
			mediaRec.onstop = onStop
			mediaRec.start()
			log('Recording…')
			recBtn.disabled = true
			stopBtn.disabled = false
			playBtn.disabled = true
			sendBtn.disabled = true
			// Clear previous
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl)
				objectUrl = null
			}
			audioEl.removeAttribute('src')
			blob = null
			outEl.textContent = ''
		} catch (e) {
			log('Mic error: ' + (e.message || e))
		}
	}

	function stop() {
		try {
			if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop()
			stopBtn.disabled = true
			recBtn.disabled = false
			log('Stopping…')
		} catch (e) {
			log('Stop error: ' + (e.message || e))
		}
	}

	function onStop() {
		try {
			blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
			objectUrl = URL.createObjectURL(blob)
			audioEl.src = objectUrl
			audioEl.load()
			log('Ready to play / send')
			playBtn.disabled = false
			sendBtn.disabled = false
			// stop mic
			mediaStream?.getTracks()?.forEach((t) => t.stop())
		} catch (e) {
			log('Assemble error: ' + (e.message || e))
		}
	}

	async function replay() {
		try {
			if (!blob) {
				log('No audio captured')
				return
			}
			await audioEl.play() // requires user gesture; we’re on a button so OK
		} catch (e) {
			log('Playback error: ' + (e.message || e))
			// Some Safari builds need a load() before play
			try {
				audioEl.load()
				await audioEl.play()
			} catch {}
		}
	}

	function blobToBase64(blob) {
		return new Promise((resolve, reject) => {
			const fr = new FileReader()
			fr.onerror = reject
			fr.onload = () => {
				const res = String(fr.result || '')
				// Ensure we send full data URL; the function will strip it safely.
				resolve(
					res.startsWith('data:')
						? res
						: 'data:' +
								(blob.type || 'application/octet-stream') +
								';base64,' +
								btoa(res)
				)
			}
			fr.readAsDataURL(blob)
		})
	}

	async function send() {
		try {
			if (!blob) {
				log('No audio to send')
				return
			}
			log('Transcribing…')
			const b64 = await blobToBase64(blob)
			const res = await fetch('/.netlify/functions/api-transcribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ audioWebmBase64: b64 }),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data?.error || 'HTTP ' + res.status)
			log('Transcribed ✔')
			printJSON(data)

			// Optional: Auto-summarise & create todos
			const sres = await fetch('/.netlify/functions/api-summarise', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ transcript: data.transcript }),
			})
			const sj = await sres.json().catch(() => ({}))
			if (sres.ok) {
				outEl.textContent +=
					'\n\n---\nSummary / Todos\n' + JSON.stringify(sj, null, 2)
			} else {
				outEl.textContent +=
					'\n\nSummarise failed: ' + (sj?.error || 'HTTP ' + sres.status)
			}
		} catch (e) {
			log('Send error: ' + (e.message || e))
		}
	}

	// Wire buttons
	if (recBtn) recBtn.addEventListener('click', start)
	if (stopBtn) stopBtn.addEventListener('click', stop)
	if (playBtn) playBtn.addEventListener('click', replay)
	if (sendBtn) sendBtn.addEventListener('click', send)

	// Initial state
	recBtn && (recBtn.disabled = false)
	stopBtn && (stopBtn.disabled = true)
	playBtn && (playBtn.disabled = true)
	sendBtn && (sendBtn.disabled = true)
	log('Idle')
})()

