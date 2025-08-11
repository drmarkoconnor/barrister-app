// src/assets/js/transcripts-list.js
(function(){
  const panel = document.getElementById('txPanel');
  if (!panel) return;

  function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
  function timeAgo(iso){
    const d = new Date(iso); const s = Math.floor((Date.now()-d.getTime())/1000);
    if (s<60) return s+'s ago'; const m=Math.floor(s/60); if(m<60) return m+'m ago';
    const h=Math.floor(m/60); if(h<24) return h+'h ago'; const d2=Math.floor(h/24); return d2+'d ago';
  }

  async function fetchJSON(url){
    const r = await fetch(url);
    const t = await r.text();
    let j; try{ j=JSON.parse(t);}catch(e){ throw new Error(t.slice(0,160)); }
    if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
    return j;
  }

  async function load(){
    panel.innerHTML = '<div class="text-muted">Loading…</div>';
    try{
      const j = await fetchJSON('/.netlify/functions/api-transcripts?limit=10');
      if(!j.items || !j.items.length){
        panel.innerHTML = '<div class="text-muted">No transcripts yet.</div>'; return;
      }
      panel.innerHTML = '';
      j.items.forEach(it=>{
        const row = document.createElement('div');
        row.className = 'list-group-item d-flex justify-content-between align-items-start';
        row.innerHTML = `
          <div class="me-3" style="flex:1 1 auto; min-width:0;">
            <div class="fw-semibold">${esc((it.text||'').slice(0,120))}${it.text && it.text.length>120 ? '…' : ''}</div>
            <div class="text-muted">${esc(it.provider||'openai-whisper')} • ${esc(new Date(it.created_at).toLocaleString())} • ${esc(timeAgo(it.created_at))}</div>
          </div>
          <div class="ms-3 d-flex align-items-center">
            <button class="btn btn-sm btn-outline-danger" data-id="${esc(it.id)}">Delete</button>
          </div>`;
        panel.appendChild(row);
      });

      panel.addEventListener('click', async (e)=>{
        const btn = e.target.closest('button[data-id]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (!confirm('Delete this transcript?')) return;
        btn.disabled = true;
        try{
          const r = await fetch('/.netlify/functions/api-transcripts?id='+encodeURIComponent(id), { method: 'DELETE' });
          const t = await r.text();
          let j; try{ j = JSON.parse(t); } catch { throw new Error(t); }
          if (!r.ok) throw new Error(j.error || ('HTTP '+r.status));
          // Remove the item row
          btn.closest('.list-group-item')?.remove();
          if (!panel.querySelector('.list-group-item')) panel.innerHTML = '<div class="text-muted">No transcripts yet.</div>';
        }catch(err){
          alert('Failed to delete: '+err.message);
          btn.disabled = false;
        }
      }, { once: false });

    }catch(err){
      panel.innerHTML = '<div class="text-danger">Failed to load transcripts: '+esc(err.message)+'</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();
