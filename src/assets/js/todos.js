// src/assets/js/todos.js
(function(){
  const list = document.getElementById('todoList');
  const form = document.getElementById('newTodoForm');
  const titleInput = document.getElementById('newTodoTitle');

  if (!list) return; // page might not have todos

  function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }

  async function fetchJSON(url, opts) {
    const r = await fetch(url, opts);
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch (e) { throw new Error(t); }
    if (!r.ok) throw new Error(j.error || ('HTTP '+r.status));
    return j;
  }

  async function load() {
    list.innerHTML = '<div class="text-muted small px-2">Loading…</div>';
    try {
      const data = await fetchJSON('/.netlify/functions/api-todos?status=open&limit=50');
      if (!data.items || !data.items.length) {
        list.innerHTML = '<div class="text-muted small px-2">No open todos.</div>';
        return;
      }
      list.innerHTML = data.items.map(it => `
        <div class="d-flex align-items-center border rounded p-2 mb-2" data-id="${esc(it.id)}">
          <div class="form-check me-2">
            <input class="form-check-input todo-done" type="checkbox" ${it.status==='done'?'checked':''} />
          </div>
          <div class="flex-grow-1">${esc(it.title)}</div>
          <button class="btn btn-sm btn-outline-danger ms-2 todo-del">Delete</button>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = '<div class="text-danger small px-2">Failed to load todos: '+esc(e.message)+'</div>';
    }
  }

  // Add new todo
  form && form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = (titleInput?.value || '').trim();
    if (!title) return;
    try {
      await fetchJSON('/.netlify/functions/api-todos', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ title })
      });
      titleInput.value = '';
      await load();
    } catch (e) {
      alert('Failed to create: ' + e.message);
    }
  });

  // Event delegation for mark done / delete
  list.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const id = row.getAttribute('data-id');

    // Delete
    if (e.target.closest('.todo-del')) {
      if (!confirm('Delete this todo?')) return;
      try {
        await fetchJSON('/.netlify/functions/api-todos?id=' + encodeURIComponent(id), { method: 'DELETE' });
        row.remove();
        if (!list.querySelector('[data-id]')) list.innerHTML = '<div class="text-muted small px-2">No open todos.</div>';
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
      return;
    }
  });

  // Check/uncheck (mark done)
  list.addEventListener('change', async (e) => {
    const box = e.target.closest('.todo-done');
    if (!box) return;
    const row = e.target.closest('[data-id]');
    const id = row.getAttribute('data-id');
    const newStatus = box.checked ? 'done' : 'open';
    // optimistic UI
    try {
      await fetchJSON('/.netlify/functions/api-todos', {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (newStatus === 'done') row.remove();
      if (!list.querySelector('[data-id]')) list.innerHTML = '<div class="text-muted small px-2">No open todos.</div>';
    } catch (err) {
      alert('Failed to update: ' + err.message);
      // revert checkbox
      box.checked = !box.checked;
    }
  });

  document.addEventListener('DOMContentLoaded', load);
})();
