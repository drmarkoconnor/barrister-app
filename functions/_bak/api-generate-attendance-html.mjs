// functions/api-generate-attendance-html.mjs
// GET: /.netlify/functions/api-generate-attendance-html?id=<attendance_note_uuid>
// Returns: text/html (ready to print to PDF)

import { supabaseAdmin, ownerId } from './util/supabase.js'

function html(status, htmlBody) {
	return {
		statusCode: status,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
		body: String(htmlBody || ''),
	}
}
function json(status, obj) {
	return {
		statusCode: status,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(obj),
	}
}
function esc(s) {
	return String(s ?? '').replace(
		/[&<>"']/g,
		(m) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
				m
			])
	)
}

export const handler = async (event) => {
	try {
		if (event.httpMethod !== 'GET')
			return json(405, { error: 'Method not allowed' })

		const supabase = supabaseAdmin()
		const OWN = ownerId()

		const raw =
			event.rawUrl ||
			`http://local${event.path}${
				event.queryStringParameters
					? '?' + new URLSearchParams(event.queryStringParameters)
					: ''
			}`
		const url = new URL(raw)
		const id = (url.searchParams.get('id') || '').trim()
		if (!id) return json(400, { error: 'id is required' })

		// Load note
		const { data: note, error } = await supabase
			.from('attendance_notes')
			.select('*')
			.eq('owner_id', OWN)
			.eq('id', id)
			.single()

		if (error || !note) return json(404, { error: 'Attendance note not found' })

		// Build derived fields
		const clientFull = [note.client_first_name, note.client_last_name]
			.filter(Boolean)
			.join(' ')
		const caseTitle = `R v ${esc(note.client_last_name || '')}`
		const courtDate = esc(note.court_date || '')
		const nextDate = esc(note.next_appearance_date || '')
		const coram = esc(note.coram || note.judge_name || '')
		const contra = esc(note.contra || '')
		const lawFirm = esc(note.law_firm || '')
		const lawyer = esc(note.lawyer_name || '')
		const courtName = esc(note.court_name || '')

		const body = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Attendance Note — ${caseTitle}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
  body { background:#f8f9fa; }
  .report-card { background:#fff; border-radius:12px; padding:28px; box-shadow:0 2px 10px rgba(0,0,0,.06); }
  .k { color:#6c757d; width:220px; }
  .v { font-weight:500; }
  .h-line { border-top:1px solid #e9ecef; margin:1rem 0 1.25rem; }
  .section-title { font-size:1.05rem; letter-spacing:.02em; color:#0d6efd; text-transform:uppercase; margin-top:.75rem; }
  @media print {
    body { background:#fff; }
    .no-print { display:none !important; }
    .report-card { box-shadow:none; border:0; padding:0; }
  }
</style>
</head>
<body class="p-3 p-md-4">
  <div class="container">
    <div class="d-flex justify-content-between align-items-center no-print mb-3">
      <div class="small text-muted">Generated ${new Date().toLocaleString()}</div>
      <div>
        <button class="btn btn-outline-secondary btn-sm me-2" onclick="window.history.back()">Back</button>
        <button class="btn btn-primary btn-sm" onclick="window.print()">Print / PDF</button>
      </div>
    </div>

    <div class="report-card">
      <div class="d-flex align-items-center mb-3">
        <div>
          <h1 class="h3 mb-1">Attendance Note</h1>
          <div class="text-muted">${caseTitle}</div>
        </div>
      </div>

      <div class="h-line"></div>

      <div class="row gy-2">
        <div class="col-md-6 d-flex"><div class="k">Client</div><div class="v">${esc(
					clientFull
				)}</div></div>
        <div class="col-md-6 d-flex"><div class="k">Court</div><div class="v">${courtName}</div></div>

        <div class="col-md-6 d-flex"><div class="k">Coram</div><div class="v">${coram}</div></div>
        <div class="col-md-6 d-flex"><div class="k">Contra</div><div class="v">${contra}</div></div>

        <div class="col-md-6 d-flex"><div class="k">Hearing Date</div><div class="v">${courtDate}</div></div>
        <div class="col-md-6 d-flex"><div class="k">Next Appearance</div><div class="v">${
					nextDate || '—'
				}</div></div>

        <div class="col-md-6 d-flex"><div class="k">Instructed by</div><div class="v">${lawFirm}${
			lawFirm && lawyer ? ' — ' : ''
		}${lawyer}</div></div>
        <div class="col-md-6 d-flex"><div class="k">Status</div><div class="v text-capitalize">${esc(
					note.status || 'draft'
				)}</div></div>
      </div>

      <div class="h-line"></div>

      <div class="section-title">Advice</div>
      <div class="mb-3" style="white-space:pre-wrap">${esc(
				note.advice_text || ''
			)}</div>

      <div class="section-title">Closing</div>
      <div style="white-space:pre-wrap">${esc(note.closing_text || '')}</div>

      <div class="mt-4 small text-muted">
        Thank you for instructing me in this matter. If you have any questions or require anything further, please contact chambers.
      </div>
    </div>
  </div>
</body>
</html>`

		return html(200, body)
	} catch (e) {
		console.error('api-generate-attendance-html error', e)
		return json(500, { error: 'Internal error', details: e.message })
	}
}

