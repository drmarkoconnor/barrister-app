// src/assets/js/attendance.js — ASCII-only

(function () {
  function $(s) { return document.querySelector(s); }
  function byName(n) { return document.querySelector('[name="'+n+'"]'); }
  function setText(sel, s) { var el=$(sel); if(el) el.textContent=s; }
  function enable(el, on){ if(el) el.disabled = !on; }

  var idInput    = $("#note_id");
  var statusSel  = $("#status_select");
  var saveBtn    = $("#saveBtn");
  var archiveBtn = $("#archiveBtn");
  var viewBtn    = $("#viewReportBtn");
  var polishBtn  = $("#polishBtn");
  var adviceTA   = $("#advice_text");

  function setInputsDisabled(disabled){
    document.querySelectorAll("#attForm input, #attForm select, #attForm textarea")
      .forEach(function(el){
        if (el.id === "status_select") return;
        el.disabled = disabled;
      });
  }
  function setStatusUI(s){
    if(statusSel) statusSel.value = s;
    var isDraft = (s === "draft");
    setInputsDisabled(!isDraft);
    enable(saveBtn,   isDraft);
    enable(polishBtn, isDraft);
    enable(archiveBtn, s === "sent");
    enable(viewBtn, !!(idInput && idInput.value));
  }

  function formToJSON(){
    var data = {};
    new FormData($("#attForm")).forEach(function(v,k){ data[k]=String(v||""); });
    return data;
  }

  async function fetchJSON(url, opt){
    var r = await fetch(url, opt);
    var t = await r.text();
    try { var j = JSON.parse(t); } catch(e){ throw new Error("Bad JSON: "+t.slice(0,140)); }
    if(!r.ok) throw new Error(j.error || ("HTTP "+r.status));
    return j;
  }

  async function loadItem(id){
    setText("#formStatus","Loading…");
    var j = await fetchJSON("/.netlify/functions/api-attendance-notes?id="+encodeURIComponent(id));
    if(!j.item) throw new Error("Missing item");
    var it = j.item;

    // Map server keys to form field names if needed
    var map = { partner_name: "lawyer_name" };
    Object.keys(it).forEach(function(k){
      var name = map[k] || k;
      var el = byName(name);
      if(el) el.value = (it[k]==null ? "" : String(it[k]));
    });

    idInput.value = it.id;
    var st = it.status || "draft";
    statusSel && statusSel.setAttribute("data-current", st);
    setStatusUI(st);
    setText("#formStatus","");
    enable(viewBtn, true);
  }

  async function createItem(payload){
    var j = await fetchJSON("/.netlify/functions/api-attendance-notes",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    return j.id;
  }

  async function updateItem(id, payload){
    await fetchJSON("/.netlify/functions/api-attendance-notes",{
      method:"PATCH",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(Object.assign({ id:id }, payload))
    });
  }

  async function setStatus(next){
    await fetchJSON("/.netlify/functions/api-attendance-notes",{
      method:"PATCH",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ action:"status", id: idInput.value, status: next })
    });
  }

  async function archiveItem(){
    await fetchJSON("/.netlify/functions/api-attendance-notes",{
      method:"PATCH",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ action:"archive", id: idInput.value })
    });
  }

  async function polishAdvice(){
    var raw = (adviceTA.value||"").trim();
    if(raw.length<5){ setText("#adviceStatus","Enter some text first"); return; }
    setText("#adviceStatus","Polishing…");
    try{
      var j = await fetchJSON("/.netlify/functions/api-polish-advice",{
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ text: raw })
      });
      adviceTA.value = j.polished || raw;
      setText("#adviceStatus","Done ✔");
      setTimeout(function(){ setText("#adviceStatus",""); }, 1200);
    }catch(e){
      setText("#adviceStatus","Failed: "+e.message);
    }
  }

  function wireEvents(){
    if(polishBtn) polishBtn.addEventListener("click", function(){
      if (!polishBtn.disabled) polishAdvice();
    });

    if(saveBtn) saveBtn.addEventListener("click", async function(){
      setText("#formStatus","Saving…");
      try{
        var payload = formToJSON();
        var curId = idInput.value;
        if(!curId){
          // New record
          var newId = await createItem(payload);
          idInput.value = newId;
          // update URL so reloads/open work
          var url = new URL(location.href);
          url.searchParams.set("id", newId);
          history.replaceState(null, "", url.toString());
          enable(viewBtn, true);
          setStatusUI("draft");
        }else{
          await updateItem(curId, payload);
        }
        setText("#formStatus","Saved ✔");
        setTimeout(function(){ setText("#formStatus",""); }, 1200);
      }catch(e){
        setText("#formStatus","Failed: "+e.message);
      }
    });

    if(statusSel) statusSel.addEventListener("change", async function(){
      var cur = statusSel.getAttribute("data-current") || "draft";
      var next = statusSel.value;
      if(!idInput.value){ setStatusUI(next); return; } // new note, not saved yet
      var ok = (cur==="draft" && next==="final") || (cur==="final" && next==="sent") || (cur===next);
      if(!ok){ alert("Cannot change status "+cur.toUpperCase()+" → "+next.toUpperCase()); statusSel.value = cur; return; }
      try{ await setStatus(next); statusSel.setAttribute("data-current", next); setStatusUI(next); setText("#formStatus","Status updated ✔"); setTimeout(function(){ setText("#formStatus",""); },1200); }
      catch(e){ alert("Failed: "+e.message); statusSel.value = cur; }
    });

    if(archiveBtn) archiveBtn.addEventListener("click", async function(){
      setText("#formStatus","Archiving…");
      try{ await archiveItem(); setText("#formStatus","Archived ✔"); setTimeout(function(){ setText("#formStatus",""); },1200); }
      catch(e){ setText("#formStatus","Failed: "+e.message); }
    });

    if(viewBtn) viewBtn.addEventListener("click", async function(){
      if(!idInput.value) return;
      var url = "/.netlify/functions/api-generate-attendance-html?id="+encodeURIComponent(idInput.value)+"&include_expenses=0";
      var w = window.open("", "_blank"); if(!w) return alert("Popup blocked");
      var r = await fetch(url); var html = await r.text();
      w.document.open(); w.document.write(html); w.document.close();
    });
  }

  document.addEventListener("DOMContentLoaded", async function(){
    wireEvents();
    // New note path: no id → editable draft; Save will create
    var qs = new URLSearchParams(location.search);
    var editId = (qs.get("id")||"").trim();
    if(!editId){
      statusSel && statusSel.setAttribute("data-current","draft");
      setStatusUI("draft");
      return;
    }
    // Open existing
    try{ await loadItem(editId); }
    catch(e){ setText("#formStatus","Load failed: "+e.message); setStatusUI("draft"); }
  });
})();
