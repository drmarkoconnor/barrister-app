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
		const outcome = text(note.outcome || '')
		const remand = text(note.remand || '')
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

		// Inline-styled HTML snippet for email clients (better paste results)
		const emailHtml = (() => {
			const normalize = (s) =>
				String(s ?? '')
					.replace(/[\u2018\u2019]/g, "'")
					.replace(/[\u201C\u201D]/g, '"')
					.replace(/[\u2013\u2014]/g, '-')
					.replace(/\u00A0/g, ' ')
			const escS = (s) =>
				normalize(s)
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/\"/g, '&quot;')
					.replace(/'/g, '&#39;')
			const row = (k, v) =>
				`<tr><td style="color:#666;padding:4px 8px;width:180px;vertical-align:top">${escS(
					k
				)}</td><td style="padding:4px 8px;vertical-align:top">${v}</td></tr>`
			const money = (n) => `\u00a3${Number(n || 0).toFixed(2)}`
			const expTable = expenses.length
				? `<table style="border-collapse:collapse;width:100%;margin-top:6px;font-size:14px">
					<thead><tr><th style=\"text-align:left;padding:4px 8px;border-bottom:1px solid #ddd\">Type</th><th style=\"text-align:right;padding:4px 8px;border-bottom:1px solid #ddd\">Amount</th></tr></thead>
					<tbody>${expenses
						.map(
							(e) =>
								`<tr><td style=\"padding:4px 8px;border-bottom:1px solid #eee\">${escS(
									e.expense_type
								)}</td><td style=\"padding:4px 8px;border-bottom:1px solid #eee;text-align:right\">${money(
									Number(e.amount || 0)
								)}</td></tr>`
						)
						.join('')}</tbody>
					<tfoot><tr><th style=\"padding:4px 8px;text-align:right\">Total</th><th style=\"padding:4px 8px;text-align:right\">${escS(
						totalFmt
					)}</th></tr></tfoot>
				</table>`
				: `<div style=\"color:#666\">No expense lines.</div>`
			return (
				`<!doctype html><meta charset=\"utf-8\"><div style=\"font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.45\">` +
				`<h2 style=\"margin:0 0 8px 0;font-size:18px\">Attendance Note - ${escS(
					caseTitle
				)}</h2>` +
				`<table style=\"border-collapse:collapse;width:100%;font-size:14px;margin:6px 0 10px 0\">` +
				row('Client', escS(clientFull)) +
				row('Court', escS(courtName)) +
				row('Coram', escS(coram)) +
				row('Contra', escS(contra)) +
				row('Hearing Type', hearingType ? escS(hearingType) : '—') +
				row('Hearing Date', escS(courtDate)) +
				row('Next Steps Date', nextDate ? escS(nextDate) : '—') +
				row('Outcome', outcome ? escS(outcome) : '—') +
				row('Remand', remand ? escS(remand) : '—') +
				row(
					'Instructed by',
					`${escS(lawFirm)}${lawFirm && lawyer ? ' — ' : ''}${escS(lawyer)}`
				) +
				(counsel ? row('Counsel', escS(counsel)) : '') +
				`</table>` +
				`<div style=\"font-size:14px;margin:10px 0 4px 0;color:#0d6efd;text-transform:uppercase;letter-spacing:.02em\">Advice</div>` +
				`<div style=\"white-space:pre-wrap;font-size:14px\">${escS(
					advice
				)}</div>` +
				(closing
					? `<div style=\\"font-size:14px;margin:10px 0 4px 0;color:#0d6efd;text-transform:uppercase;letter-spacing:.02em\\">Closing</div><div style=\\"white-space:pre-wrap;font-size:14px\\">${escS(
							closing
					  )}</div>`
					: '') +
				(includeExpenses
					? `<div style=\\"font-size:14px;margin:10px 0 4px 0;color:#0d6efd;text-transform:uppercase;letter-spacing:.02em\\">Expenses</div>` +
					  expTable
					: '') +
				`</div>`
			)
		})()
		const emailHtmlB64 = Buffer.from(emailHtml, 'utf8').toString('base64')

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
	@media print { body { background:#fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display:none !important; } .report-card { box-shadow:none; border:0; padding:0; } }
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
 	const EMAIL_HTML_B64 = '${emailHtmlB64}'
 	window.EMAIL_HTML_B64 = EMAIL_HTML_B64
 	function copyEmailHtml(){
 		const b64 = (window.EMAIL_HTML_B64 && window.EMAIL_HTML_B64 !== '') ? window.EMAIL_HTML_B64 : '${'${'}EMAIL_HTML_B64${'}'}'
 		const html = atob(b64);
 		if (navigator.clipboard && window.ClipboardItem) {
 			const toPlain = (h)=>{ const d=document.createElement('div'); d.innerHTML=h; return d.innerText }
 			const item = new ClipboardItem({
 				'text/html': new Blob([html], { type: 'text/html' }),
 				'text/plain': new Blob([toPlain(html)], { type: 'text/plain' })
 			})
 			navigator.clipboard.write([item]).then(()=>toast('Copied email HTML')).catch(()=>fallback())
 		} else { fallback() }
 		function fallback(){
 			const temp = document.createElement('div'); temp.contentEditable='true'; temp.style.position='fixed'; temp.style.left='-9999px';
 			document.body.appendChild(temp); temp.innerHTML = html;
 			const range = document.createRange(); range.selectNodeContents(temp);
 			const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
 			try { document.execCommand('copy'); toast('Copied email HTML') } catch(e) { toast('Copy failed') }
 			sel.removeAllRanges(); document.body.removeChild(temp);
 		}
 	}
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
				<button class="btn btn-outline-dark btn-sm btn-copy" onclick="copyEmailHtml()">Copy Email HTML</button>
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
				<div class="col-md-6 d-flex"><div class="k">Outcome</div><div class="v">${
					outcome ? esc(outcome) : '—'
				}</div></div>
				<div class="col-md-6 d-flex"><div class="k">Remand</div><div class="v">${
					remand ? esc(remand) : '—'
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

