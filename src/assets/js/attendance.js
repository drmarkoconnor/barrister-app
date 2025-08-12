// src/assets/js/attendance.js — ASCII-only

;(function () {
	function $(s) {
		return document.querySelector(s)
	}
	function byName(n) {
		return document.querySelector('[name="' + n + '"]')
	}
	function setText(sel, s) {
		var el = $(sel)
		if (el) el.textContent = s
	}
	function enable(el, on) {
		if (el) el.disabled = !on
	}
	function todayStr() {
		return new Date().toISOString().slice(0, 10)
	}

	async function loadDirectory(type, datalistId) {
		try {
			var url =
				'/.netlify/functions/api-directory?type=' + encodeURIComponent(type)
			var r = await fetch(url)
			var t = await r.text()
			var j
			try {
				j = JSON.parse(t)
			} catch {
				j = null
			}
			if (!r.ok || !j || !Array.isArray(j.items)) return
			var dl = document.getElementById(datalistId)
			if (dl) {
				dl.innerHTML = j.items
					.map(function (v) {
						v = String(v || '').trim()
						return v
							? '<option value="' + v.replace(/"/g, '&quot;') + '"></option>'
							: ''
					})
					.join('')
			}

			// No special-case for selects; inputs + datalists are used for consistency.
		} catch (e) {
			console.warn('directory load failed', type, e)
		}
	}

	var form = $('#attForm')
	var idInput = $('#note_id')
	var statusSel = $('#status_select')
	var saveBtn = $('#saveBtn')
	var archiveBtn = $('#archiveBtn')
	var viewBtn = $('#viewReportBtn')
	var polishBtn = $('#polishBtn')
	var adviceTA = $('#advice_text')

	function setInputsDisabled(disabled) {
		document
			.querySelectorAll('#attForm input, #attForm select, #attForm textarea')
			.forEach(function (el) {
				if (el.id === 'status_select') return
				el.disabled = disabled
			})
	}
	function setStatusUI(s) {
		if (statusSel) statusSel.value = s
		var isDraft = s === 'draft'
		setInputsDisabled(!isDraft)
		enable(saveBtn, isDraft)
		enable(polishBtn, isDraft)
		enable(archiveBtn, s === 'sent')
		enable(viewBtn, !!(idInput && idInput.value))
	}

	function formToJSON() {
		var data = {}
		var fd = new FormData(form)
		fd.forEach(function (v, k) {
			if (k === 'exp_type[]' || k === 'exp_amount[]') return // handled below
			data[k] = String(v || '')
		})

		// No "Other..." support needed with inputs + datalists
		// Gather expenses into array of objects
		var typs = Array.from(
			document.querySelectorAll('input[name="exp_type[]"]')
		).map(function (i) {
			return (i.value || '').trim()
		})
		var amts = Array.from(
			document.querySelectorAll('input[name="exp_amount[]"]')
		).map(function (i) {
			return (i.value || '').trim()
		})
		var exps = []
		for (var i = 0; i < Math.max(typs.length, amts.length); i++) {
			var t = (typs[i] || '').trim()
			var a = parseFloat(amts[i] || '')
			if (!t && !(a > 0)) continue
			exps.push({
				type: t,
				amount: isFinite(a) && a > 0 ? Number(a.toFixed(2)) : 0,
			})
		}
		// Always include expenses array so server can delete when empty
		data.expenses = exps
		// Guard: ensure court_date is set (DB NOT NULL)
		if (!data.court_date) {
			var cd = byName('court_date')
			var val = todayStr()
			if (cd) cd.value = val
			data.court_date = val
		}
		return data
	}

	async function fetchJSON(url, opt) {
		var r = await fetch(url, opt)
		var t = await r.text()
		var j
		try {
			j = JSON.parse(t)
		} catch (e) {
			throw new Error('Bad JSON: ' + t.slice(0, 160))
		}
		if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status)
		return j
	}

	async function loadItem(id) {
		setText('#formStatus', 'Loading…')
		var j = await fetchJSON(
			'/.netlify/functions/api-attendance-notes?id=' +
				encodeURIComponent(id) +
				'&include_expenses=1'
		)
		if (!j.item) throw new Error('Missing item')
		var it = j.item

		var map = {} // (we now match DB names)
		Object.keys(it).forEach(function (k) {
			var name = map[k] || k
			var el = byName(name)
			if (el) el.value = it[k] == null ? '' : String(it[k])
		})

		// Back-compat: if API returned next_appearance_date, fill next_steps_date field
		try {
			var ns = byName('next_steps_date')
			if (ns && !ns.value) {
				var legacy = it.next_appearance_date || ''
				if (legacy) ns.value = legacy
			}
		} catch {}

		// Ensure selects display values even if not yet in directory lists
		try {
			var htSel0 = document.getElementById('hearing_type_select')
			var htVal0 =
				(byName('hearing_type') && byName('hearing_type').value) || ''
			if (htSel0 && htVal0) {
				var hasHt = Array.from(htSel0.options).some(function (o) {
					return o.value === htVal0
				})
				if (!hasHt) {
					var opt = document.createElement('option')
					opt.value = htVal0
					opt.textContent = htVal0
					htSel0.appendChild(opt)
					htSel0.value = htVal0
				}
			}
			var cSel0 = document.getElementById('contra_select')
			var cVal0 = (byName('contra') && byName('contra').value) || ''
			if (cSel0 && cVal0) {
				var hasC = Array.from(cSel0.options).some(function (o) {
					return o.value === cVal0
				})
				if (!hasC) {
					var opt2 = document.createElement('option')
					opt2.value = cVal0
					opt2.textContent = cVal0
					cSel0.appendChild(opt2)
					cSel0.value = cVal0
				}
			}
		} catch {}

		idInput.value = it.id
		var st = it.status || 'draft'
		statusSel && statusSel.setAttribute('data-current', st)
		setStatusUI(st)
		setText('#formStatus', '')
		enable(viewBtn, true)

		// Render existing expenses, if any
		try {
			var list = document.getElementById('expensesList')
			var addBtn = document.getElementById('addExpenseBtn')
			if (list && addBtn) {
				list.innerHTML = ''
				var exps = Array.isArray(j.expenses) ? j.expenses : []
				if (exps.length === 0) {
					// seed one row when none
					addBtn.click()
				} else {
					exps.forEach(function (e) {
						addBtn.click()
						var rows = list.querySelectorAll('.row')
						var row = rows[rows.length - 1]
						var t = row.querySelector('input[name="exp_type[]"]')
						var a = row.querySelector('input[name="exp_amount[]"]')
						if (t) t.value = (e.expense_type || '').trim()
						if (a) a.value = String(e.amount || '')
					})
				}
			}
		} catch (e) {
			console.warn('render expenses failed', e)
		}
	}

	async function createItem(payload) {
		var j = await fetchJSON('/.netlify/functions/api-attendance-notes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		return j.id
	}

	async function updateItem(id, payload) {
		await fetchJSON('/.netlify/functions/api-attendance-notes', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(Object.assign({ id: id }, payload)),
		})
	}

	async function setStatus(next) {
		await fetchJSON('/.netlify/functions/api-attendance-notes', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'status',
				id: idInput.value,
				status: next,
			}),
		})
	}

	async function archiveItem() {
		await fetchJSON('/.netlify/functions/api-attendance-notes', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'archive', id: idInput.value }),
		})
	}

	async function polishAdvice() {
		var raw = (adviceTA.value || '').trim()
		if (raw.length < 5) {
			setText('#adviceStatus', 'Enter some text first')
			return
		}
		setText('#adviceStatus', 'Polishing…')
		try {
			var j = await fetchJSON('/.netlify/functions/api-polish-advice', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: raw }),
			})
			adviceTA.value = j.polished || raw
			setText('#adviceStatus', 'Done ✔')
			setTimeout(function () {
				setText('#adviceStatus', '')
			}, 1200)
		} catch (e) {
			setText('#adviceStatus', 'Failed: ' + e.message)
		}
	}

	function wireEvents() {
		if (polishBtn)
			polishBtn.addEventListener('click', function () {
				if (!polishBtn.disabled) polishAdvice()
			})

		if (saveBtn)
			saveBtn.addEventListener('click', async function () {
				// Native required validation first
				if (form && !form.reportValidity()) return

				// debouce / prevent double-submits
				enable(saveBtn, false)
				setText('#formStatus', 'Saving…')
				try {
					var payload = formToJSON()
					var curId = idInput.value
					if (!curId) {
						var newId = await createItem(payload)
						idInput.value = newId
						var url = new URL(location.href)
						url.searchParams.set('id', newId)
						history.replaceState(null, '', url.toString())
						enable(viewBtn, true)
						setStatusUI('draft')
					} else {
						await updateItem(curId, payload)
					}
					setText('#formStatus', 'Saved ✔')
					setTimeout(function () {
						setText('#formStatus', '')
					}, 1200)
				} catch (e) {
					setText('#formStatus', 'Failed: ' + e.message)
				} finally {
					enable(saveBtn, true)
				}
			})

		// Contra "Other…" UI toggle
		try {
			var sel = document.getElementById('contra_select')
			var otherWrap = document.getElementById('contra_other_wrap')
			var otherInp = document.getElementById('contra_other')
			if (sel) {
				sel.addEventListener('change', function () {
					var isOther = sel.value === '__OTHER__'
					if (otherWrap) otherWrap.style.display = isOther ? '' : 'none'
					if (isOther && otherInp) otherInp.focus()
				})
			}
		} catch {}

		// Hearing Type "Other…" UI toggle
		try {
			var sel2 = document.getElementById('hearing_type_select')
			var otherWrap2 = document.getElementById('hearing_type_other_wrap')
			var otherInp2 = document.getElementById('hearing_type_other')
			if (sel2) {
				sel2.addEventListener('change', function () {
					var isOther = sel2.value === '__OTHER__'
					if (otherWrap2) otherWrap2.style.display = isOther ? '' : 'none'
					if (isOther && otherInp2) otherInp2.focus()
				})
			}
		} catch {}

		if (statusSel)
			statusSel.addEventListener('change', async function () {
				var cur = statusSel.getAttribute('data-current') || 'draft'
				var next = statusSel.value
				if (!idInput.value) {
					setStatusUI(next)
					return
				}
				var ok =
					(cur === 'draft' && next === 'final') ||
					(cur === 'final' && next === 'sent') ||
					cur === next
				if (!ok) {
					alert(
						'Cannot change status ' +
							cur.toUpperCase() +
							' → ' +
							next.toUpperCase()
					)
					statusSel.value = cur
					return
				}
				try {
					await setStatus(next)
					statusSel.setAttribute('data-current', next)
					setStatusUI(next)
					setText('#formStatus', 'Status updated ✔')
					setTimeout(function () {
						setText('#formStatus', '')
					}, 1200)
				} catch (e) {
					alert('Failed: ' + e.message)
					statusSel.value = cur
				}
			})

		if (archiveBtn)
			archiveBtn.addEventListener('click', async function () {
				setText('#formStatus', 'Archiving…')
				try {
					await archiveItem()
					setText('#formStatus', 'Archived ✔')
					setTimeout(function () {
						setText('#formStatus', '')
					}, 1200)
				} catch (e) {
					setText('#formStatus', 'Failed: ' + e.message)
				}
			})

		// View report: save first (create/update), then open report in new tab
		if (viewBtn)
			viewBtn.addEventListener('click', async function () {
				try {
					// Always save current form so expenses and fields persist
					var payload = formToJSON()
					var curId = (idInput.value || '').trim()
					if (!curId) {
						curId = await createItem(payload)
						idInput.value = curId
						var url1 = new URL(location.href)
						url1.searchParams.set('id', curId)
						history.replaceState(null, '', url1.toString())
						enable(viewBtn, true)
						setStatusUI('draft')
					} else {
						await updateItem(curId, payload)
					}

					var incl = document.getElementById('includeExpenses')
					var include = incl && incl.checked ? '1' : '0'
					var mcb = document.getElementById('includeMobile')
					var mobile = mcb && mcb.checked ? '1' : '0'
					var url =
						'/.netlify/functions/api-generate-attendance-html?id=' +
						encodeURIComponent(curId) +
						'&include_expenses=' +
						include +
						'&include_mobile=' +
						mobile
					window.open(url, '_blank')
				} catch (e) {
					alert('Failed to generate report: ' + e.message)
				}
			})
	}

	document.addEventListener('DOMContentLoaded', async function () {
		wireEvents()

		// Populate dynamic lists
		loadDirectory('judges', 'dl_judges')
		loadDirectory('lawyers', 'dl_lawyers')
		loadDirectory('law_firms', 'dl_firms')
		loadDirectory('courtrooms', 'dl_courts')
		loadDirectory('contra', 'dl_contra')
		loadDirectory('hearing_types', 'dl_hearing_types')

		// Auto-construct first advice line if empty and key fields present
		try {
			var adv = document.getElementById('advice_text')
			function maybeSeedAdvice() {
				if (!adv || (adv.value || '').trim()) return
				var fn = byName('client_first_name')?.value?.trim() || ''
				var ln = byName('client_last_name')?.value?.trim() || ''
				var court = byName('court_name')?.value?.trim() || ''
				var firm = byName('law_firm')?.value?.trim() || ''
				var ht = byName('hearing_type')?.value?.trim() || ''
				if (ln && court && firm) {
					var name = (fn ? fn + ' ' : '') + ln
					var line =
						'I was instructed to represent ' +
						name +
						' at ' +
						(court || 'court') +
						(firm ? ' by ' + firm : '') +
						(ht ? ' for ' + ht : '') +
						'. '
					adv.value = line
				}
			}
			;[
				'client_first_name',
				'client_last_name',
				'court_name',
				'law_firm',
				'hearing_type',
			].forEach(function (n) {
				var el = byName(n)
				if (el) el.addEventListener('blur', maybeSeedAdvice)
			})
		} catch {}

		// If creating a new note (no id), prefill court_date to today for convenience
		var qs = new URLSearchParams(location.search)
		var editId = (qs.get('id') || '').trim()
		if (!editId) {
			var cd = byName('court_date')
			if (cd && !cd.value) cd.value = todayStr()
			statusSel && statusSel.setAttribute('data-current', 'draft')
			setStatusUI('draft')
			return
		}
		try {
			await loadItem(editId)
		} catch (e) {
			setText('#formStatus', 'Load failed: ' + e.message)
			setStatusUI('draft')
		}
	})
})()

