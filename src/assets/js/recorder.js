// src/assets/js/recorder.js
// ASCII-only. Works with MediaRecorder when available, otherwise falls back to <input capture>.

;(function () {
	document.addEventListener('DOMContentLoaded', function () {
		// Elements
		const recBtn = document.getElementById('recBtn')
		const stopBtn = document.getElementById('stopBtn')
		const playBtn = document.getElementById('playBtn')
		const sendBtn = document.getElementById('sendBtn')
		const audioEl = document.getElementById('preview')
		const statusEl = document.getElementById('recStatus')
		const outEl = document.getElementById('recOut')
		const transcriptEl = document.getElementById('recTranscript')
		const summaryEl = document.getElementById('recSummary')
		const todosEl = document.getElementById('recTodos')
		const fileCap = document.getElementById('fileCapture') // hidden input for fallback

		// State
		let mediaStream = null
		let mediaRec = null
		let chunks = []
		let mimeType = ''
		let blob = null
		let objectUrl = null
		let usingFallback = false

		function setStatus(kind, msg) {
			if (!statusEl) return
			statusEl.className = 'alert py-2 px-3 mb-3 ' + (kind || 'alert-secondary')
			statusEl.textContent = msg
		}
		function log(msg) {
			setStatus('alert-info', msg)
			console.log('[rec]', msg)
		}
		function printJSON(obj) {
			if (!outEl) return
			outEl.textContent = JSON.stringify(obj, null, 2)
		}

		function renderTranscript(text) {
			if (transcriptEl) transcriptEl.textContent = text || ''
		}
		function renderSummaryTodos(summary, todos) {
			if (summaryEl) summaryEl.textContent = summary || ''
			if (todosEl) {
				todosEl.innerHTML = ''
				;(Array.isArray(todos) ? todos : []).forEach(function (t) {
					var li = document.createElement('li')
					li.className =
						'list-group-item d-flex justify-content-between align-items-center'
					var title = t && t.title ? String(t.title) : ''
					var due = t && t.due_at ? String(t.due_at) : null
					li.innerHTML =
						'<span>' +
						title.replace(/</g, '&lt;') +
						'</span>' +
						(due
							? '<span class="badge bg-secondary">Due ' + due + '</span>'
							: '')
					todosEl.appendChild(li)
				})
			}
		}
		function clearPreview() {
			try {
				if (objectUrl) URL.revokeObjectURL(objectUrl)
			} catch {}
			objectUrl = null
			if (audioEl) {
				audioEl.pause()
				audioEl.removeAttribute('src')
				audioEl.load()
			}
			blob = null
		}

		function pickMime() {
			const cands = [
				'audio/mp4;codecs=aac', // Safari/iOS (playback friendly)
				'audio/webm;codecs=opus', // Chrome/Firefox/Edge
				'audio/webm',
			]
			if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return ''
			for (const c of cands) if (MediaRecorder.isTypeSupported(c)) return c
			return '' // let browser decide
		}

		async function startRec() {
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				// fallback: use file input
				usingFallback = true
				if (!fileCap) {
					log('Mic not supported and no file capture available')
					return
				}
				log('Opening device recorder…')
				fileCap.click()
				return
			}

			try {
				mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
			} catch (e) {
				// User denied OR no mic: fallback to file
				usingFallback = true
				if (!fileCap) {
					log('Mic permission denied and no file capture available')
					return
				}
				log('Permission denied. Use device recorder.')
				fileCap.click()
				return
			}

			// We have a mic stream. Try MediaRecorder.
			if (!window.MediaRecorder) {
				usingFallback = true
				if (!fileCap) {
					log('MediaRecorder not supported; use device recorder')
					return
				}
				log('MediaRecorder not supported; opening device recorder…')
				fileCap.click()
				return
			}

			try {
				mimeType = pickMime() // may be ''
				chunks = []
				mediaRec = mimeType
					? new MediaRecorder(mediaStream, { mimeType })
					: new MediaRecorder(mediaStream)
			} catch (e) {
				// Some Safari builds dislike options; try without
				try {
					mediaRec = new MediaRecorder(mediaStream)
				} catch (e2) {
					usingFallback = true
					if (!fileCap) {
						log('Recorder init failed; use device recorder')
						return
					}
					log('Recorder init failed; opening device recorder…')
					fileCap.click()
					return
				}
			}

			// Happy path
			mediaRec.ondataavailable = (e) => {
				if (e.data && e.data.size) chunks.push(e.data)
			}
			mediaRec.onstop = onStopMediaRec
			mediaRec.start()
			log('Recording…')
			recBtn.disabled = true
			stopBtn.disabled = false
			playBtn.disabled = true
			sendBtn.disabled = true
			clearPreview()
		}

		function stopRec() {
			if (usingFallback) {
				log('Use device UI to stop, or select the file')
				return
			}
			try {
				if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop()
				stopBtn.disabled = true
				recBtn.disabled = false
				setStatus('alert-warning', 'Stopping…')
			} catch (e) {
				log('Stop error: ' + (e.message || e))
			}
		}

		function onStopMediaRec() {
			try {
				blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
				objectUrl = URL.createObjectURL(blob)
				audioEl.src = objectUrl
				audioEl.load()
				setStatus('alert-success', 'Ready to play / send')
				playBtn.disabled = false
				sendBtn.disabled = false
				// stop mic tracks
				mediaStream && mediaStream.getTracks().forEach((t) => t.stop())
			} catch (e) {
				log('Assemble error: ' + (e.message || e))
			}
		}

		// Fallback: when user picks a file from native recorder
		if (fileCap) {
			fileCap.addEventListener('change', function () {
				const f = fileCap.files && fileCap.files[0]
				if (!f) {
					log('No file selected')
					return
				}
				clearPreview()
				blob = f
				objectUrl = URL.createObjectURL(f)
				audioEl.src = objectUrl
				audioEl.load()
				log('File ready to play / send')
				playBtn.disabled = false
				sendBtn.disabled = false
				// Reset flag for next time
				usingFallback = false
			})
		}

		async function replay() {
			if (!blob) {
				log('No audio captured')
				return
			}
			try {
				await audioEl.play()
			} catch (e) {
				try {
					audioEl.load()
					await audioEl.play()
				} catch {}
				if (e && e.message) log('Playback error: ' + e.message)
			}
		}

		function blobToDataURL(b) {
			return new Promise((resolve, reject) => {
				const fr = new FileReader()
				fr.onerror = reject
				fr.onload = () => resolve(String(fr.result || ''))
				fr.readAsDataURL(b)
			})
		}

		async function send() {
			if (!blob) {
				log('No audio to send')
				return
			}
			setStatus('alert-info', 'Transcribing…')
			try {
				const dataUrl = await blobToDataURL(blob)
				const res = await fetch('/.netlify/functions/api-transcribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ audioWebmBase64: dataUrl }),
				})
				const data = await res.json().catch(() => ({}))
				if (!res.ok)
					throw new Error(
						data && data.error ? data.error : 'HTTP ' + res.status
					)
				setStatus('alert-success', 'Transcribed ✔')
				renderTranscript(data && data.transcript ? data.transcript : '')
				printJSON(data)

				// Optional: summarise
				const sres = await fetch('/.netlify/functions/api-summarise', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ transcript: data.transcript }),
				})
				const sj = await sres.json().catch(() => ({}))
				if (sres.ok) {
					renderSummaryTodos(
						sj && sj.summary ? sj.summary : '',
						sj && sj.todos ? sj.todos : []
					)
					outEl.textContent +=
						'\n\n---\nSummary / Todos\n' + JSON.stringify(sj, null, 2)
				} else {
					setStatus(
						'alert-warning',
						'Summarise failed: ' +
							(sj && sj.error ? sj.error : 'HTTP ' + sres.status)
					)
				}
			} catch (e) {
				setStatus('alert-danger', 'Send error: ' + (e.message || e))
			}
		}

		// Wire buttons
		if (recBtn) recBtn.addEventListener('click', startRec)
		if (stopBtn) stopBtn.addEventListener('click', stopRec)
		if (playBtn) playBtn.addEventListener('click', replay)
		if (sendBtn) sendBtn.addEventListener('click', send)

		// Initial UI state
		recBtn && (recBtn.disabled = false)
		stopBtn && (stopBtn.disabled = true)
		playBtn && (playBtn.disabled = true)
		sendBtn && (sendBtn.disabled = true)
		setStatus(
			'alert-secondary',
			'Idle (MediaRecorder ' +
				(window.MediaRecorder ? 'present' : 'missing') +
				')'
		)
	})
})()

