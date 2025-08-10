// Netlify function: GET (list/read), POST (create), PATCH (update/status/archive)
import { supabaseAdmin, ownerId } from './util/supabase.js'

function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  }
}
function safeParse(s) {
  try { return JSON.parse(s || '{}') } catch { return null }
}

export const handler = async (event) => {
  try {
    const supabase = supabaseAdmin()
    const OWN = ownerId()

    // GET: list or single
    if (event.httpMethod === 'GET') {
      const url = new URL(event.rawUrl || `http://x${event.path}?${event.queryStringParameters || ''}`)
      const id = url.searchParams.get('id')
      const status = url.searchParams.get('status')
      const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)

      if (id) {
        const { data, error } = await supabase
          .from('attendance_notes')
          .select('*')
          .eq('owner_id', OWN)
          .eq('id', id)
          .single()
        if (error) return json(404, { error: 'Not found' })
        return json(200, { item: data })
      }

      let q = supabase
        .from('attendance_notes')
        .select('*')
        .eq('owner_id', OWN)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (status) q = q.eq('status', status)

      const { data, error } = await q
      if (error) return json(500, { error: 'List failed' })
      return json(200, { items: data, count: data?.length || 0 })
    }

    // POST: create new record (used when no id yet)
    if (event.httpMethod === 'POST') {
      const body = safeParse(event.body)
      if (!body) return json(400, { error: 'Invalid JSON' })

      // Minimal required fields — relax if you like
      const client_first_name = (body.client_first_name || '').trim()
      const client_last_name  = (body.client_last_name || '').trim()

      if (!client_first_name || !client_last_name) {
        return json(400, { error: 'client_first_name and client_last_name are required' })
      }

      const row = {
        owner_id: OWN,
        client_first_name,
        client_last_name,
        court_date: body.court_date || null,
        next_appearance_date: body.next_appearance_date || null,
        court_name: body.court_name || null,
        law_firm: body.law_firm || null,
        lawyer_name: body.lawyer_name || null,
        coram: body.coram || null,
        contra: body.contra || null,
        advice_text: body.advice_text || '',
        closing_text: body.closing_text || '',
        status: (body.status || 'draft'),
        archived: false,
      }

      const { data, error } = await supabase
        .from('attendance_notes')
        .insert([row])
        .select('id')
        .single()

      if (error) {
        console.error('Create attendance note error', error)
        return json(500, { error: 'Create failed' })
      }
      return json(200, { id: data.id })
    }

    // PATCH: update fields OR change status OR archive
    if (event.httpMethod === 'PATCH') {
      const body = safeParse(event.body)
      if (!body || !body.id) return json(400, { error: 'id is required' })

      // status transition
      if (body.action === 'status') {
        const next = String(body.status || '').trim()
        if (!['draft', 'final', 'sent'].includes(next)) {
          return json(400, { error: 'Invalid status' })
        }
        const { error } = await supabase
          .from('attendance_notes')
          .update({ status: next })
          .eq('owner_id', OWN)
          .eq('id', body.id)
        if (error) return json(500, { error: 'Status update failed' })
        return json(200, { ok: true })
      }

      // archive
      if (body.action === 'archive') {
        const { error } = await supabase
          .from('attendance_notes')
          .update({ archived: true })
          .eq('owner_id', OWN)
          .eq('id', body.id)
        if (error) return json(500, { error: 'Archive failed' })
        return json(200, { ok: true })
      }

      // general field update
      const up = { ...body }
      delete up.id
      delete up.action
      const { error } = await supabase
        .from('attendance_notes')
        .update(up)
        .eq('owner_id', OWN)
        .eq('id', body.id)
      if (error) return json(500, { error: 'Update failed' })
      return json(200, { ok: true })
    }

    return json(405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('api-attendance-notes error', e)
    return json(500, { error: 'Internal error in api-attendance-notes' })
  }
}
