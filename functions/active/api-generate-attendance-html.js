// GET: /.netlify/functions/api-generate-attendance-html?id=<attendance_note_uuid>
// Returns: text/html (ready to print to PDF)

import { supabaseAdmin, ownerId } from './util/supabase.js'
import fs from 'node:fs'
import path from 'node:path'

function html(status, htmlBody) {
	return {
		statusCode: status,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
		body: String(htmlBody || ''),
	}
}
const json = (s, o) => ({
	statusCode: s,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(o),
})
const esc = (s) =>
	String(s ?? '').replace(
		/[&<>"']/g,
		(m) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
				m
			])
	)
const text = (s) => String(s ?? '')
const dateUK = (iso) => {
	try {
		const d = new Date(iso)
		return d.toLocaleDateString('en-GB', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		})
	} catch {
		return iso || ''
	}
}

// Load site data from repo (copied into function via included_files in netlify.toml)
let siteData = null
try {
	const jsonPath = path.resolve(process.cwd(), 'src/_data/site.json')
	if (fs.existsSync(jsonPath)) {
		siteData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
	}
} catch {}

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
		const includeExpenses =
			(url.searchParams.get('include_expenses') || '').trim() === '1'
		const includeMobile =
			(url.searchParams.get('include_mobile') || '').trim() === '1'
		if (!id) return json(400, { error: 'id is required' })

		const { data: note, error } = await supabase
			.from('attendance_notes')
			.select('*')
			.eq('owner_id', OWN)
			.eq('id', id)
			.single()

		if (error || !note) return json(404, { error: 'Attendance note not found' })

		let expenses = []
		if (includeExpenses) {
			const { data: ex } = await supabase
				.from('attendance_expenses')
				.select('expense_type, amount, created_at')
				.eq('owner_id', OWN)
				.eq('attendance_note_id', id)
				.order('created_at', { ascending: true })
			expenses = Array.isArray(ex) ? ex : []
		}

		const clientFull = [note.client_first_name, note.client_last_name]
			.filter(Boolean)
			.join(' ')
		const caseTitle = `Rex v ${text(note.client_last_name || '')}`
		const courtDate = dateUK(note.court_date)
		const nextDate =
			note.next_steps_date || note.next_appearance_date
				? dateUK(note.next_steps_date || note.next_appearance_date)
				: ''
		const coram = text(note.coram || note.judge_name || '')
		const contra = text(note.contra || '')
		const lawFirm = text(note.law_firm || '')
		const lawyer = text(note.lawyer_name || '')
		const courtName = text(note.court_name || '')
		const hearingType = text(note.hearing_type || '')
		const closing = text(note.closing_text || '')
		const advice = text(note.advice_text || '')
		const counsel = process.env.COUNSEL_NAME
			? text(process.env.COUNSEL_NAME)
			: ''
		const chambersName = siteData?.chambers?.name || '23ES Chambers'
		const chambersEmail = siteData?.chambers?.email || 'clerks@23es.com'
		const chambersPhone = siteData?.chambers?.phone_london || '020 7413 0353'
		const chambersAddr = siteData?.chambers?.address || ''
		const counselMobile =
			includeMobile && process.env.COUNSEL_MOBILE
				? text(process.env.COUNSEL_MOBILE)
				: ''
		const genAt = new Date().toLocaleString('en-GB', {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		})
		const totalExpenses = expenses.reduce(
			(sum, e) => sum + (Number(e.amount) || 0),
			0
		)
		const totalFmt = totalExpenses ? `\u00a3${totalExpenses.toFixed(2)}` : ''

		const body = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Attendance Note — ${esc(caseTitle)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
	body { background:#f8f9fa; }
	.report-card { background:#fff; border-radius:12px; padding:28px; box-shadow:0 2px 10px rgba(0,0,0,.06); }
	.k { color:#6c757d; width:220px; }
	.v { font-weight:500; }
	.h-line { border-top:1px solid #e9ecef; margin:1rem 0 1.25rem; }
	.section-title { font-size:1.05rem; letter-spacing:.02em; color:#0d6efd; text-transform:uppercase; margin-top:.75rem; }
	@media print { body { background:#fff; } .no-print { display:none !important; } .report-card { box-shadow:none; border:0; padding:0; } }
	.footer { color:#6c757d; font-size: 12px; }
	.footer a { color: inherit; text-decoration: none; }
	.btn-copy { border: 1px solid #dee2e6; }
	table.table-sm td, table.table-sm th { padding: .4rem; }
	.badge-status { font-size:.7rem; }
	.subtext { font-size:.9rem; color:#6c757d; }
	.copy-toast { position:fixed; bottom:12px; right:12px; background:#212529; color:#fff; padding:8px 12px; border-radius:8px; opacity:0; transform:translateY(8px); transition:all .2s; }
	.copy-toast.show { opacity:1; transform:none; }
 </style>
 <script>
	 function copyHtml(){
		 const el = document.querySelector('.report-card');
		 if(!el) return;
		 const range = document.createRange(); range.selectNode(el);
		 const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
		 try { document.execCommand('copy'); toast('Copied HTML'); } catch(e) { toast('Copy failed'); }
		 sel.removeAllRanges();
	 }
	 function copyText(){
		 const el = document.querySelector('.report-card');
		 if(!el) return;
		 const text = el.innerText;
		 navigator.clipboard?.writeText(text).then(()=>toast('Copied text')).catch(()=>toast('Copy failed'))
	 }
	 function toast(msg){
		 const t = document.getElementById('copyToast'); t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1200)
	 }
 </script>
</head>
<body class="p-3 p-md-4">
	<div class="container">
		<div class="d-flex justify-content-between align-items-center no-print mb-3">
			<div class="small text-muted">Generated ${esc(genAt)}</div>
			<div class="d-flex gap-2">
				<a class="btn btn-outline-secondary btn-sm" href="/app/attendance/list/">Back to list</a>
				<button class="btn btn-outline-secondary btn-sm" onclick="window.close()">Close tab</button>
				<button class="btn btn-outline-dark btn-sm btn-copy" onclick="copyHtml()">Copy HTML</button>
				<button class="btn btn-outline-dark btn-sm btn-copy" onclick="copyText()">Copy Text</button>
				<button class="btn btn-primary btn-sm" onclick="window.print()">Print / PDF</button>
			</div>
		</div>

		<div class="report-card">
			<div class="mb-3">
				<h1 class="h3 mb-1">${esc(caseTitle)}</h1>
				<div class="text-muted">Attendance Note</div>
			</div>

			<div class="h-line"></div>

			<div class="row gy-2">
				<div class="col-md-6 d-flex"><div class="k">Client</div><div class="v">${esc(
					clientFull
				)}</div></div>
				<div class="col-md-6 d-flex"><div class="k">Court</div><div class="v">${esc(
					courtName
				)}</div></div>
				<div class="col-md-6 d-flex"><div class="k">Coram</div><div class="v">${esc(
					coram
				)}</div></div>
				<div class="col-md-6 d-flex"><div class="k">Contra</div><div class="v">${esc(
					contra
				)}</div></div>
				<div class="col-md-6 d-flex"><div class="k">Hearing Type</div><div class="v">${
					hearingType ? esc(hearingType) : '—'
				}</div></div>
				<div class="col-md-6 d-flex"><div class="k">Hearing Date</div><div class="v">${esc(
					courtDate
				)}</div></div>
				<div class="col-md-6 d-flex"><div class="k">Next Steps Date</div><div class="v">${
					nextDate ? esc(nextDate) : '—'
				}</div></div>
				<div class="col-md-6 d-flex"><div class="k">Instructed by</div><div class="v">${esc(
					lawFirm
				)}${lawFirm && lawyer ? ' — ' : ''}${esc(lawyer)}</div></div>
				${
					counsel
						? `<div class="col-md-6 d-flex"><div class="k">Counsel</div><div class="v">${esc(
								counsel
						  )}</div></div>`
						: ''
				}
			</div>

			<div class="h-line"></div>

			<div class="section-title">Advice</div>
			<div class="mb-3" style="white-space:pre-wrap">${esc(advice)}</div>

			${
				closing
					? `<div class="section-title">Closing</div><div style="white-space:pre-wrap">${esc(
							closing
					  )}</div>`
					: ''
			}

			${
				includeExpenses
					? `
			<div class="h-line"></div>
			<div class="section-title">Expenses</div>
			<div class="table-responsive">
				${
					expenses.length
						? `
				<table class="table table-sm">
					<thead><tr><th>Type</th><th class="text-end">Amount</th></tr></thead>
					<tbody>
						${expenses
							.map(
								(e) =>
									`<tr><td>${esc(
										text(e.expense_type)
									)}</td><td class="text-end">\u00a3${Number(
										e.amount || 0
									).toFixed(2)}</td></tr>`
							)
							.join('')}
					</tbody>
					<tfoot><tr><th class="text-end">Total</th><th class="text-end">${esc(
						totalFmt
					)}</th></tr></tfoot>
				</table>`
						: `<div class="subtext">No expense lines.</div>`
				}
			</div>`
					: ''
			}

			<div class="h-line"></div>
			<div class="footer">
				<div class="subtext">Status: ${esc(
					text(note.status || 'draft').toUpperCase()
				)}</div>
				<div>${esc(chambersName)}${chambersAddr ? ' • ' + esc(chambersAddr) : ''}</div>
				<div>${
					chambersEmail
						? `<a href="mailto:${esc(chambersEmail)}">${esc(chambersEmail)}</a>`
						: ''
				}${chambersEmail && (chambersPhone || counselMobile) ? ' • ' : ''}${
			chambersPhone ? esc(chambersPhone) : ''
		}${chambersPhone && counselMobile ? ' • ' : ''}${
			counselMobile ? 'Personal mobile: ' + esc(counselMobile) : ''
		}</div>
				<div class="subtext">Generated ${esc(genAt)}</div>
			</div>
		</div>

		<div id="copyToast" class="copy-toast">Copied</div>
	</div>
</body>
</html>`

		return html(200, body)
	} catch (e) {
		console.error('api-generate-attendance-html error', e)
		return json(500, { error: 'Internal error', details: e.message })
	}
}

