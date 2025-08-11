// functions/api-generate-attendance-html.js
import 'dotenv/config'
import { supabaseAdmin, ownerId } from './util/supabase.js'

function text(v, fallback = '') {
	return (v == null ? fallback : String(v)).trim()
}
function esc(s) {
	return String(s || '').replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
	)
}
function dateUK(iso) {
	try {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		})
	} catch {
		return iso || ''
	}
}

export const handler = async (event) => {
	try {
		if (event.httpMethod !== 'GET')
			return html(405, `<p>Method not allowed</p>`)

		const id = text(event.queryStringParameters?.id)
		const includeExpenses =
			text(event.queryStringParameters?.include_expenses) === '1'
		if (!id) return html(400, `<p>Missing ?id</p>`)

		const supabase = supabaseAdmin()
		const OWN = ownerId()

		const { data: note, error: nErr } = await supabase
			.from('attendance_notes')
			.select('*')
			.eq('owner_id', OWN)
			.eq('id', id)
			.single()
		if (nErr || !note) return html(404, `<p>Attendance note not found.</p>`)

		let expenses = []
		if (includeExpenses) {
			const { data: ex } = await supabase
				.from('attendance_expenses')
				.select('expense_type, amount, created_at')
				.eq('attendance_note_id', id)
				.order('created_at', { ascending: true })
			expenses = Array.isArray(ex) ? ex : []
		}

		const courtName = text(note.court_name)
		const clientFirst = text(note.client_first_name)
		const clientLast = text(note.client_last_name)
		const courtDate = dateUK(note.court_date)
		const lawFirm = text(note.law_firm)
		const lawyerName = text(note.partner_name)
		const coram = text(note.coram)
		const contra = text(note.contra)
		const nextAppr = note.next_appearance_date
			? dateUK(note.next_appearance_date)
			: ''
		const advice = text(note.advice_text)
		const closing = text(note.closing_text)
		const counsel = process.env.COUNSEL_NAME
			? text(process.env.COUNSEL_NAME)
			: 'Mark O’Connor'
		const headerTitle = `Rex v ${clientLast || '—'}`
		const totalExpenses = expenses.reduce(
			(sum, e) => sum + (Number(e.amount) || 0),
			0
		)
		const totalFmt = totalExpenses ? `£${totalExpenses.toFixed(2)}` : ''

		const doc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Attendance Note – ${esc(headerTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --fg:#111; --muted:#555; --line:#ddd; --accent:#0d6efd; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:var(--fg); margin: 24px; }
  h1,h2,h3 { margin: 0 0 8px; }
  h1 { font-size: 22px; }
  h2 { font-size: 18px; border-bottom:1px solid var(--line); padding-bottom:6px; margin-top:18px; }
  .muted { color: var(--muted); }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
  .row { display:flex; gap:8px; align-items:baseline; }
  .label { min-width: 160px; color:var(--muted); }
  .box { border:1px solid var(--line); border-radius:8px; padding:12px; margin-top:10px; }
  table { width:100%; border-collapse:collapse; margin-top:10px; }
  th, td { text-align:left; padding:8px; border-bottom:1px solid var(--line); }
  .total { text-align:right; font-weight:600; }
  .footer { margin-top:24px; font-size: 12px; color: var(--muted); }
  .header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px; }
  .title { font-size: 24px; font-weight:700; }
  .badge { font-size:12px; color:white; background:var(--accent); padding:2px 8px; border-radius:12px; }
  @media print { .noprint { display:none; } body { margin:0; padding:24px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="muted">${esc(courtName || 'In the Crown Court')}</div>
      <div class="title">${esc(headerTitle)}</div>
      <div class="muted">Attendance Note – ${esc(courtDate)}</div>
    </div>
    <div><span class="badge">${esc(
			text(note.status || 'draft').toUpperCase()
		)}</span></div>
  </div>

  <h2>Parties & Details</h2>
  <div class="box">
    <div class="grid">
      <div class="row"><div class="label">Client:</div><div>${esc(
				clientFirst
			)} ${esc(clientLast)}</div></div>
      <div class="row"><div class="label">Counsel:</div><div>${esc(
				counsel
			)}</div></div>
      <div class="row"><div class="label">Coram:</div><div>${esc(
				coram
			)}</div></div>
      <div class="row"><div class="label">Contra:</div><div>${esc(
				contra
			)}</div></div>
      <div class="row"><div class="label">Court:</div><div>${esc(
				courtName
			)}</div></div>
      <div class="row"><div class="label">Law firm:</div><div>${esc(
				lawFirm
			)}</div></div>
      <div class="row"><div class="label">Lawyer:</div><div>${esc(
				lawyerName
			)}</div></div>
      <div class="row"><div class="label">Date:</div><div>${esc(
				courtDate
			)}</div></div>
      ${
				nextAppr
					? `<div class="row"><div class="label">Next appearance:</div><div>${esc(
							nextAppr
					  )}</div></div>`
					: ''
			}
    </div>
  </div>

  <h2>Advice</h2>
  <div class="box">
    <div>${
			advice
				? esc(advice).replace(/\\n/g, '<br>')
				: '<span class="muted">No advice supplied.</span>'
		}</div>
  </div>

  ${
		includeExpenses
			? `
  <h2>Expenses</h2>
  <div class="box">
    ${
			expenses.length
				? `
      <table>
        <thead><tr><th>Type</th><th>Amount</th></tr></thead>
        <tbody>
        ${expenses
					.map(
						(e) =>
							`<tr><td>${esc(e.expense_type)}</td><td>£${Number(
								e.amount || 0
							).toFixed(2)}</td></tr>`
					)
					.join('')}
        </tbody>
        <tfoot><tr><td class="total">Total</td><td class="total">${esc(
					totalFmt
				)}</td></tr></tfoot>
      </table>`
				: `<div class="muted">No expense lines.</div>`
		}
  </div>`
			: ''
	}

  ${
		closing
			? `
  <h2>Closing</h2>
  <div class="box">
    <div>${esc(closing)}</div>
  </div>`
			: ''
	}

  <div class="footer">
    <div>This report was generated by the Barrister App.</div>
    <div class="noprint" style="margin-top:8px;">
      <button onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`

		return {
			statusCode: 200,
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
			body: doc,
		}
	} catch (err) {
		console.error('api-generate-attendance-html error', err)
		return html(500, `<p>Internal error</p>`)
	}
}

function html(status, body) {
	return {
		statusCode: status,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
		body: `<!doctype html><meta charset="utf-8"><body>${body}</body>`,
	}
}

