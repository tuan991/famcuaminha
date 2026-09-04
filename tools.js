/* ============================================================
   FCMA — Tool implementations
   Each tool: { id, name, desc, icon, category, privacy, tags, mount(el) }
   ============================================================ */

const { $, $$, el, esc, download, copy, readFile, fmtBytes, uid, debounce } = FL.util;

// helper: simple input/output pane
function ioPane(mount, opts){
  const { inLabel='Input', outLabel='Output', inPh='Paste here…', outPh='', actions=[], onProcess } = opts;
  mount.innerHTML = `
    <div class="tool-body tool-split">
      <div class="field">
        <label>${inLabel}</label>
        <textarea id="ioIn" rows="14" placeholder="${esc(inPh)}"></textarea>
      </div>
      <div class="field">
        <label>${outLabel}</label>
        <textarea id="ioOut" rows="14" placeholder="${esc(outPh)}" readonly></textarea>
      </div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      ${actions.map(a=>`<button class="btn ${a.primary?'btn-primary':'btn-ghost'} btn-sm" data-a="${a.id}">${a.label}</button>`).join('')}
      <button class="btn btn-ghost btn-sm" data-a="_copy">📋 Copy output</button>
      <button class="btn btn-ghost btn-sm" data-a="_clear">Clear</button>
    </div>
    <div id="ioNote" style="margin-top:10px"></div>`;
  const $in = mount.querySelector('#ioIn');
  const $out = mount.querySelector('#ioOut');
  const $note = mount.querySelector('#ioNote');
  const setNote = (kind, msg) => { $note.innerHTML = msg ? `<div class="note ${kind}">${msg}</div>` : ''; };
  const process = (action) => {
    try {
      const out = onProcess($in.value, action);
      if (out !== undefined) { $out.value = out; setNote('ok', ''); }
    } catch(e){ $out.value=''; setNote('err', 'Error: '+esc(e.message)); }
  };
  $$('[data-a]', mount).forEach(b => b.addEventListener('click', ()=>{
    const a = b.dataset.a;
    if (a === '_copy'){ copy($out.value); return; }
    if (a === '_clear'){ $in.value=''; $out.value=''; setNote('ok',''); return; }
    process(a);
  }));
  $in.addEventListener('input', debounce(()=>process(actions[0]?.id||'default'), 250));
  return { $in, $out, setNote, process };
}

/* ---------- DEVELOPER TOOLS ---------- */

FL.registerAllTools = function(){

// JSON Formatter
FL.registerTool({
  id:'json-formatter', name:'JSON Formatter', desc:'Format, validate, and prettify JSON with 2 or 4 space indent.', icon:'{ }', category:'developer', privacy:'local', tags:['json','pretty','beautify'],
  mount(m){
    const io = ioPane(m, {
      inPh:'Paste JSON here…',
      actions:[{id:'format2',label:'Format (2sp)',primary:true},{id:'format4',label:'Format (4sp)'},{id:'minify',label:'Minify'},{id:'validate',label:'Validate only'}],
      onProcess: (v, action) => {
        if (!v.trim()) return '';
        const obj = JSON.parse(v);
        if (action==='minify') return JSON.stringify(obj);
        if (action==='validate') { io.setNote('ok','✓ Valid JSON — '+ (Array.isArray(obj)?obj.length+' items':typeof obj==='object'?Object.keys(obj).length+' keys':'primitive')); return v; }
        return JSON.stringify(obj, null, action==='format4'?4:2);
      }
    });
  }
});

// JSON → CSV
FL.registerTool({
  id:'json-to-csv', name:'JSON → CSV', desc:'Convert a JSON array of objects into CSV.', icon:'⇄', category:'developer', privacy:'local', tags:['json','csv','convert'],
  mount(m){
    ioPane(m, {
      inPh:'[{"name":"Alice","age":30},{"name":"Bob","age":25}]',
      actions:[{id:'go',label:'Convert',primary:true}],
      onProcess: (v) => {
        const arr = JSON.parse(v);
        if (!Array.isArray(arr) || !arr.length) throw new Error('Expected non-empty array');
        const keys = [...new Set(arr.flatMap(o=>Object.keys(o||{})))];
        const esc = s => { s=String(s??''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
        return [keys.join(','), ...arr.map(o=>keys.map(k=>esc(o[k])).join(','))].join('\n');
      }
    });
  }
});

// CSV → JSON
FL.registerTool({
  id:'csv-to-json', name:'CSV → JSON', desc:'Parse CSV (first row as headers) into JSON array.', icon:'⇄', category:'developer', privacy:'local', tags:['csv','json','convert'],
  mount(m){
    ioPane(m, {
      inPh:'name,age\nAlice,30\nBob,25',
      actions:[{id:'go',label:'Convert',primary:true}],
      onProcess: (v) => {
        const rows=[]; let row=[], cur='', inQ=false;
        for (let i=0;i<v.length;i++){
          const c=v[i], n=v[i+1];
          if (inQ){ if (c==='"' && n==='"'){cur+='"';i++;} else if (c==='"'){inQ=false;} else cur+=c; }
          else { if (c==='"') inQ=true; else if (c===','){row.push(cur);cur='';} else if (c==='\n'||c==='\r'){ if (c==='\r'&&n==='\n')i++; row.push(cur); rows.push(row); row=[]; cur=''; } else cur+=c; }
        }
        if (cur||row.length){ row.push(cur); rows.push(row); }
        if (rows.length<2) throw new Error('Need at least a header row and one data row');
        const [head,...data] = rows;
        return JSON.stringify(data.filter(r=>r.some(v=>v!=='')).map(r=>Object.fromEntries(head.map((h,i)=>[h.trim(), r[i]??'']))), null, 2);
      }
    });
  }
});

// JSON Diff
FL.registerTool({
  id:'json-diff', name:'JSON Diff', desc:'Compare two JSON objects and highlight differences.', icon:'≠', category:'developer', privacy:'local', tags:['json','diff','compare'],
  mount(m){
    m.innerHTML = `<div class="tool-body tool-split">
      <div class="field"><label>Left</label><textarea id="dL" rows="12"></textarea></div>
      <div class="field"><label>Right</label><textarea id="dR" rows="12"></textarea></div>
    </div>
    <button class="btn btn-primary btn-sm" id="dGo" style="margin-top:10px">Diff</button>
    <pre id="dOut" class="card mono" style="margin-top:12px;white-space:pre-wrap;font-size:12.5px"></pre>`;
    const diff = (a,b,path='') => {
      if (a===b) return [];
      if (typeof a!==typeof b || a===null || b===null) return [`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
      if (typeof a!=='object') return [`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
      const keys = new Set([...Object.keys(a),...Object.keys(b)]);
      const out=[]; for (const k of keys) out.push(...diff(a[k],b[k],path?path+'.'+k:k));
      return out;
    };
    $('#dGo',m).addEventListener('click', ()=>{
      try { const a=JSON.parse($('#dL',m).value); const b=JSON.parse($('#dR',m).value);
        const d = diff(a,b);
        $('#dOut',m).textContent = d.length ? d.join('\n') : '✓ Identical';
      } catch(e){ $('#dOut',m).textContent='Error: '+e.message; }
    });
  }
});

// Base64
FL.registerTool({
  id:'base64', name:'Base64 Encode / Decode', desc:'Encode text to Base64 or decode back.', icon:'6₄', category:'developer', privacy:'local', tags:['encode','decode','base64'],
  mount(m){
    ioPane(m, {
      actions:[{id:'enc',label:'Encode →',primary:true},{id:'dec',label:'← Decode'}],
      onProcess: (v, a) => a==='enc' ? btoa(unescape(encodeURIComponent(v))) : decodeURIComponent(escape(atob(v.trim())))
    });
  }
});

// URL Encode/Decode
FL.registerTool({
  id:'url-encode', name:'URL Encode / Decode', desc:'Percent-encode a string or decode one.', icon:'%', category:'developer', privacy:'local', tags:['url','encode','uri'],
  mount(m){
    ioPane(m, {
      actions:[{id:'enc',label:'Encode →',primary:true},{id:'dec',label:'← Decode'}],
      onProcess: (v,a) => a==='enc' ? encodeURIComponent(v) : decodeURIComponent(v)
    });
  }
});

// HTML Encode/Decode
FL.registerTool({
  id:'html-encode', name:'HTML Entity Encode / Decode', desc:'Convert &lt;, &gt;, &amp; between characters and entities.', icon:'&', category:'developer', privacy:'local', tags:['html','entity'],
  mount(m){
    ioPane(m, {
      actions:[{id:'enc',label:'Encode →',primary:true},{id:'dec',label:'← Decode'}],
      onProcess: (v,a) => {
        if (a==='enc') return v.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const d=document.createElement('div'); d.innerHTML=v; return d.textContent;
      }
    });
  }
});

// Hash (SHA-256, SHA-1, SHA-512, MD5 not built-in — do web-crypto)
FL.registerTool({
  id:'hash', name:'Hash Generator', desc:'Compute SHA-1 / SHA-256 / SHA-384 / SHA-512 of any text.', icon:'#', category:'developer', privacy:'local', tags:['hash','sha','crypto','checksum'],
  mount(m){
    m.innerHTML = `<div class="field"><label>Text</label><textarea id="hIn" rows="6" placeholder="Text to hash…"></textarea></div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      ${['SHA-1','SHA-256','SHA-384','SHA-512'].map(a=>`<button class="btn btn-ghost btn-sm" data-h="${a}">${a}</button>`).join('')}
    </div>
    <div id="hOut" style="margin-top:14px;display:grid;gap:6px"></div>`;
    const compute = async (alg) => {
      const enc = new TextEncoder().encode($('#hIn',m).value);
      const buf = await crypto.subtle.digest(alg, enc);
      const hex = [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
      const row = el('div',{class:'card',style:{padding:'10px'}}, el('div',{style:{fontSize:'11px',color:'var(--muted)'}}, alg), el('div',{class:'mono',style:{wordBreak:'break-all',fontSize:'12.5px'}}, hex));
      $('#hOut',m).prepend(row);
    };
    $$('[data-h]',m).forEach(b=>b.addEventListener('click',()=>compute(b.dataset.h)));
  }
});

// UUID Generator
FL.registerTool({
  id:'uuid', name:'UUID Generator', desc:'Generate UUID v4 (crypto-random).', icon:'🆔', category:'generator', privacy:'local', tags:['uuid','guid','id'],
  mount(m){
    m.innerHTML = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
      <label class="field" style="flex:1"><label>How many?</label><input id="uN" type="number" value="10" min="1" max="1000"/></label>
      <button class="btn btn-primary" id="uGo" style="align-self:end">Generate</button>
    </div>
    <textarea id="uOut" rows="14" readonly placeholder="UUIDs will appear here…"></textarea>
    <div style="margin-top:8px;display:flex;gap:8px"><button class="btn btn-ghost btn-sm" onclick="FL.util.copy(document.getElementById('uOut').value)">Copy</button></div>`;
    const gen = () => {
      const n=Math.min(1000,Math.max(1,+$('#uN',m).value||10));
      $('#uOut',m).value = Array.from({length:n}, ()=> crypto.randomUUID()).join('\n');
    };
    $('#uGo',m).addEventListener('click',gen); gen();
  }
});

// Password Generator
FL.registerTool({
  id:'password-gen', name:'Password Generator', desc:'Generate secure random passwords.', icon:'🔐', category:'generator', privacy:'local', tags:['password','secure','random'],
  mount(m){
    m.innerHTML = `<div class="grid grid-2">
      <div class="field"><label>Length</label><input id="pLen" type="number" value="20" min="4" max="128"/></div>
      <div class="field"><label>How many?</label><input id="pN" type="number" value="10" min="1" max="200"/></div>
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px">
      <label class="checkbox"><input type="checkbox" id="pU" checked/> A-Z</label>
      <label class="checkbox"><input type="checkbox" id="pL" checked/> a-z</label>
      <label class="checkbox"><input type="checkbox" id="pD" checked/> 0-9</label>
      <label class="checkbox"><input type="checkbox" id="pS" checked/> !@#$%^&*</label>
    </div>
    <button class="btn btn-primary" id="pGo" style="margin-top:10px">Generate</button>
    <textarea id="pOut" rows="12" readonly style="margin-top:12px"></textarea>`;
    const gen = () => {
      let chars='';
      if ($('#pU',m).checked) chars+='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if ($('#pL',m).checked) chars+='abcdefghijklmnopqrstuvwxyz';
      if ($('#pD',m).checked) chars+='0123456789';
      if ($('#pS',m).checked) chars+='!@#$%^&*()-_=+[]{}<>?';
      if (!chars){ FL.toast('Pick at least one character set','warn'); return; }
      const len=Math.min(128,Math.max(4,+$('#pLen',m).value||20));
      const n=Math.min(200,Math.max(1,+$('#pN',m).value||10));
      const out=[];
      for (let i=0;i<n;i++){
        const arr=new Uint32Array(len); crypto.getRandomValues(arr);
        out.push([...arr].map(x=>chars[x%chars.length]).join(''));
      }
      $('#pOut',m).value = out.join('\n');
    };
    $('#pGo',m).addEventListener('click',gen); gen();
  }
});

// JWT Decoder
FL.registerTool({
  id:'jwt', name:'JWT Decoder', desc:'Decode a JWT and inspect header + payload (does NOT verify signature).', icon:'🔑', category:'developer', privacy:'local', tags:['jwt','token','decode'],
  mount(m){
    m.innerHTML = `<div class="field"><label>JWT</label><textarea id="jIn" rows="4" placeholder="eyJhbGciOi..."></textarea></div>
    <button class="btn btn-primary btn-sm" id="jGo" style="margin-top:8px">Decode</button>
    <div class="grid grid-2" style="margin-top:12px"><div class="field"><label>Header</label><textarea id="jH" rows="8" readonly></textarea></div><div class="field"><label>Payload</label><textarea id="jP" rows="8" readonly></textarea></div></div>
    <div id="jExp" style="margin-top:10px"></div>`;
    const dec = (s) => JSON.stringify(JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))))), null, 2);
    $('#jGo',m).addEventListener('click', ()=>{
      try {
        const [h,p] = $('#jIn',m).value.trim().split('.');
        $('#jH',m).value = dec(h); $('#jP',m).value = dec(p);
        const pl = JSON.parse($('#jP',m).value);
        const exp = pl.exp ? new Date(pl.exp*1000) : null;
        $('#jExp',m).innerHTML = exp ? `<div class="note ${exp<new Date()?'err':'ok'}">exp: ${exp.toISOString()} — ${exp<new Date()?'EXPIRED':'valid'}</div>` : '';
      } catch(e){ FL.toast('Invalid JWT: '+e.message,'err'); }
    });
  }
});

// Regex Tester
FL.registerTool({
  id:'regex-tester', name:'Regex Tester', desc:'Test JavaScript-flavor regex against input, see matches.', icon:'.*', category:'developer', privacy:'local', tags:['regex','regexp','pattern'],
  mount(m){
    m.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:10px"><input id="rP" placeholder="pattern" value="\\b\\w+\\b" style="flex:1;font-family:var(--mono)"/><input id="rF" placeholder="flags" value="g" style="width:100px;font-family:var(--mono)"/></div>
    <div class="tool-body tool-split">
      <div class="field"><label>Test string</label><textarea id="rIn" rows="10">The quick brown fox jumps over the lazy dog.</textarea></div>
      <div class="field"><label>Matches</label><div id="rOut" class="card mono" style="min-height:220px;font-size:12.5px;white-space:pre-wrap;overflow:auto"></div></div>
    </div>`;
    const run = () => {
      try {
        const re = new RegExp($('#rP',m).value, $('#rF',m).value);
        const str = $('#rIn',m).value;
        const matches = [...str.matchAll(re.flags.includes('g')?re:new RegExp(re.source, re.flags+'g'))];
        $('#rOut',m).textContent = matches.length ? matches.map((mm,i)=>`#${i+1} @${mm.index}: "${mm[0]}"${mm.length>1?' groups: '+JSON.stringify(mm.slice(1)):''}`).join('\n') : '(no matches)';
      } catch(e){ $('#rOut',m).textContent = 'Error: '+e.message; }
    };
    ['input'].forEach(ev => $$('#rP,#rF,#rIn',m).forEach(n => n.addEventListener(ev, debounce(run,150))));
    run();
  }
});

// Timestamp converter
FL.registerTool({
  id:'timestamp', name:'Timestamp Converter', desc:'Convert Unix timestamps ⇄ human-readable dates.', icon:'⏱', category:'developer', privacy:'local', tags:['unix','epoch','date','time'],
  mount(m){
    m.innerHTML = `<div class="grid grid-2">
      <div class="card"><h3>Timestamp → Date</h3><input id="tIn" type="number" placeholder="e.g. 1756819200" style="margin-top:8px"/>
        <div style="margin-top:8px;display:flex;gap:8px"><button class="btn btn-ghost btn-sm" data-u="s">seconds</button><button class="btn btn-ghost btn-sm" data-u="ms">milliseconds</button></div>
        <div id="tOut" class="mono" style="margin-top:12px;font-size:13px;color:var(--text-2)">—</div></div>
      <div class="card"><h3>Date → Timestamp</h3><input id="tDate" type="datetime-local" style="margin-top:8px"/>
        <div id="tOut2" class="mono" style="margin-top:12px;font-size:13px;color:var(--text-2)">—</div></div>
    </div>
    <div style="margin-top:12px;text-align:center"><span class="chip">Now: <span id="tNow"></span></span></div>`;
    const paintNow = () => { $('#tNow',m).textContent = Math.floor(Date.now()/1000) + ' (' + new Date().toISOString() + ')'; };
    paintNow(); const iv = setInterval(paintNow, 1000);
    m.addEventListener('DOMNodeRemoved', ()=>clearInterval(iv));
    const conv = (u) => {
      const v = +$('#tIn',m).value; if (!v){ $('#tOut',m).textContent='—'; return; }
      const d = new Date(u==='s'?v*1000:v);
      $('#tOut',m).innerHTML = `<div>ISO: ${d.toISOString()}</div><div>Local: ${d.toString()}</div><div>UTC: ${d.toUTCString()}</div>`;
    };
    $$('[data-u]',m).forEach(b=>b.addEventListener('click',()=>conv(b.dataset.u)));
    $('#tIn',m).addEventListener('input',()=>conv('s'));
    $('#tDate',m).addEventListener('input',e=>{ const d = new Date(e.target.value); $('#tOut2',m).innerHTML = e.target.value ? `<div>Seconds: ${Math.floor(d.getTime()/1000)}</div><div>Milliseconds: ${d.getTime()}</div>` : '—'; });
  }
});

// Color Converter
FL.registerTool({
  id:'color', name:'Color Converter', desc:'HEX ⇄ RGB ⇄ HSL, with live preview.', icon:'🎨', category:'developer', privacy:'local', tags:['color','hex','rgb','hsl'],
  mount(m){
    m.innerHTML = `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <div id="cSwatch" style="width:80px;height:80px;border-radius:12px;background:#ff6a2b;border:1px solid var(--line)"></div>
      <div style="flex:1;min-width:220px">
        <div class="field"><label>HEX</label><input id="cHex" value="#ff6a2b"/></div>
        <div class="grid grid-2" style="margin-top:8px"><div class="field"><label>RGB</label><input id="cRgb" value="rgb(255,106,43)" readonly/></div><div class="field"><label>HSL</label><input id="cHsl" value="hsl(17,100%,58%)" readonly/></div></div>
      </div>
      <input type="color" id="cPick" value="#ff6a2b" style="width:80px;height:80px;border:0;padding:0;background:transparent"/>
    </div>`;
    const toHsl = (r,g,b) => { r/=255;g/=255;b/=255; const mx=Math.max(r,g,b), mn=Math.min(r,g,b); let h,s,l=(mx+mn)/2; if(mx===mn){h=s=0;} else { const d=mx-mn; s=l>.5?d/(2-mx-mn):d/(mx+mn); switch(mx){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;} h*=60; } return [Math.round(h),Math.round(s*100),Math.round(l*100)]; };
    const paint = (hex) => {
      hex = hex.replace('#',''); if (hex.length===3) hex = [...hex].map(c=>c+c).join('');
      if (!/^[0-9a-f]{6}$/i.test(hex)) return;
      const r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16);
      const [h,s,l]=toHsl(r,g,b);
      $('#cSwatch',m).style.background = '#'+hex;
      $('#cRgb',m).value = `rgb(${r},${g},${b})`;
      $('#cHsl',m).value = `hsl(${h},${s}%,${l}%)`;
      $('#cPick',m).value = '#'+hex;
    };
    $('#cHex',m).addEventListener('input',e=>paint(e.target.value));
    $('#cPick',m).addEventListener('input',e=>{ $('#cHex',m).value=e.target.value; paint(e.target.value); });
    paint('#ff6a2b');
  }
});

// SQL Formatter (very simple)
FL.registerTool({
  id:'sql-format', name:'SQL Formatter', desc:'Basic SQL beautifier — keywords on new lines.', icon:'🗄', category:'developer', privacy:'local', tags:['sql','format','beautify'],
  mount(m){
    ioPane(m, {
      inPh:'select * from users where id=1',
      actions:[{id:'go',label:'Format',primary:true}],
      onProcess: (v) => {
        const KW = ['SELECT','FROM','WHERE','AND','OR','LEFT JOIN','RIGHT JOIN','INNER JOIN','JOIN','ON','GROUP BY','ORDER BY','LIMIT','OFFSET','HAVING','UNION','INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','CREATE TABLE'];
        let s = v.replace(/\s+/g,' ').trim();
        for (const k of KW) s = s.replace(new RegExp('\\b'+k.replace(/ /g,'\\s+')+'\\b','gi'), '\n'+k);
        return s.trim();
      }
    });
  }
});

/* ---------- TEXT TOOLS ---------- */

FL.registerTool({
  id:'word-counter', name:'Word Counter', desc:'Count words, characters, sentences and reading time.', icon:'✎', category:'text', privacy:'local', tags:['count','words'],
  mount(m){
    m.innerHTML = `<textarea id="wIn" rows="14" placeholder="Type or paste text…"></textarea>
    <div class="grid grid-4" style="margin-top:14px">
      ${['Words','Characters','Chars (no spaces)','Sentences','Paragraphs','Reading time'].map((l,i)=>`<div class="card" style="text-align:center"><div style="font-size:22px;font-weight:700;color:var(--accent)" id="w${i}">0</div><div class="muted" style="font-size:12px;margin-top:2px">${l}</div></div>`).join('')}
    </div>`;
    const paint = () => {
      const t = $('#wIn',m).value;
      $('#w0',m).textContent = (t.match(/\b\w+\b/g)||[]).length;
      $('#w1',m).textContent = t.length;
      $('#w2',m).textContent = t.replace(/\s/g,'').length;
      $('#w3',m).textContent = (t.match(/[.!?]+/g)||[]).length;
      $('#w4',m).textContent = t.split(/\n\s*\n/).filter(p=>p.trim()).length;
      const mins = Math.max(1, Math.round((t.match(/\b\w+\b/g)||[]).length / 200));
      $('#w5',m).textContent = mins+' min';
    };
    $('#wIn',m).addEventListener('input', paint); paint();
  }
});

FL.registerTool({
  id:'case-convert', name:'Case Converter', desc:'UPPER, lower, Title, camelCase, snake_case, kebab-case, CONSTANT.', icon:'Aa', category:'text', privacy:'local', tags:['case','upper','lower'],
  mount(m){
    const conv = {
      upper: s=>s.toUpperCase(),
      lower: s=>s.toLowerCase(),
      title: s=>s.replace(/\w\S*/g, w=>w[0].toUpperCase()+w.slice(1).toLowerCase()),
      sentence: s=>s.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c=>c.toUpperCase()),
      camel: s=>s.toLowerCase().replace(/[^a-z0-9]+(.)/g,(_,c)=>c.toUpperCase()),
      pascal: s=>{const c=s.toLowerCase().replace(/[^a-z0-9]+(.)/g,(_,c)=>c.toUpperCase()); return c[0]?c[0].toUpperCase()+c.slice(1):c;},
      snake: s=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),
      kebab: s=>s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
      const: s=>s.toUpperCase().trim().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,''),
    };
    ioPane(m, {
      actions:Object.keys(conv).map((k,i)=>({id:k,label:k.toUpperCase(),primary:i===0})),
      onProcess: (v,a) => conv[a] ? conv[a](v) : v
    });
  }
});

FL.registerTool({
  id:'sort-lines', name:'Sort / Dedupe Lines', desc:'Sort lines alphabetically or remove duplicates.', icon:'↕', category:'text', privacy:'local', tags:['sort','dedupe','unique'],
  mount(m){
    ioPane(m, {
      actions:[{id:'sortA',label:'Sort A→Z',primary:true},{id:'sortZ',label:'Sort Z→A'},{id:'dedupe',label:'Dedupe'},{id:'reverse',label:'Reverse'},{id:'trim',label:'Trim & clean'}],
      onProcess: (v,a) => {
        const lines = v.split('\n');
        if (a==='sortA') return lines.sort((a,b)=>a.localeCompare(b)).join('\n');
        if (a==='sortZ') return lines.sort((a,b)=>b.localeCompare(a)).join('\n');
        if (a==='dedupe') return [...new Set(lines)].join('\n');
        if (a==='reverse') return lines.reverse().join('\n');
        if (a==='trim') return lines.map(l=>l.trim()).filter(Boolean).join('\n');
        return v;
      }
    });
  }
});

FL.registerTool({
  id:'find-replace', name:'Find & Replace', desc:'Find & replace with optional regex and case-insensitive matching.', icon:'⇄', category:'text', privacy:'local', tags:['find','replace','substitute'],
  mount(m){
    m.innerHTML = `<div class="grid grid-2" style="margin-bottom:8px">
      <input id="fF" placeholder="Find"/><input id="fR" placeholder="Replace with"/>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:10px"><label class="checkbox"><input type="checkbox" id="fRe"/> Regex</label><label class="checkbox"><input type="checkbox" id="fI"/> Case-insensitive</label></div>
    <div class="tool-body tool-split">
      <div class="field"><label>Input</label><textarea id="fIn" rows="12"></textarea></div>
      <div class="field"><label>Output</label><textarea id="fOut" rows="12" readonly></textarea></div>
    </div>
    <button class="btn btn-primary btn-sm" id="fGo" style="margin-top:10px">Replace</button>`;
    $('#fGo',m).addEventListener('click',()=>{
      try {
        const isRe = $('#fRe',m).checked; const ci = $('#fI',m).checked;
        const find = isRe ? new RegExp($('#fF',m).value, 'g'+(ci?'i':'')) : $('#fF',m).value;
        const rep = $('#fR',m).value;
        const inp = $('#fIn',m).value;
        $('#fOut',m).value = isRe ? inp.replace(find, rep) : inp.split(ci?new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'):find).join(rep);
      } catch(e){ FL.toast('Regex error: '+e.message,'err'); }
    });
  }
});

FL.registerTool({
  id:'text-diff', name:'Text Diff', desc:'Line-by-line diff between two texts.', icon:'≠', category:'text', privacy:'local', tags:['diff','compare'],
  mount(m){
    m.innerHTML = `<div class="tool-body tool-split">
      <div class="field"><label>Left</label><textarea id="lA" rows="12"></textarea></div>
      <div class="field"><label>Right</label><textarea id="lB" rows="12"></textarea></div>
    </div>
    <button class="btn btn-primary btn-sm" id="lGo" style="margin-top:10px">Diff</button>
    <div id="lOut" class="card mono" style="margin-top:12px;font-size:12.5px;white-space:pre-wrap"></div>`;
    $('#lGo',m).addEventListener('click',()=>{
      const a = $('#lA',m).value.split('\n'); const b = $('#lB',m).value.split('\n');
      const max = Math.max(a.length, b.length); const out = [];
      for (let i=0;i<max;i++){
        if (a[i]===b[i]) out.push(`  ${esc(a[i]??'')}`);
        else { if (a[i]!=null) out.push(`<span style="color:#f87171">- ${esc(a[i])}</span>`); if (b[i]!=null) out.push(`<span style="color:#4ade80">+ ${esc(b[i])}</span>`); }
      }
      $('#lOut',m).innerHTML = out.join('\n');
    });
  }
});

FL.registerTool({
  id:'slugify', name:'Slugify', desc:'Convert a title into a URL-friendly slug.', icon:'/', category:'text', privacy:'local', tags:['slug','url'],
  mount(m){
    ioPane(m, { actions:[{id:'go',label:'Slugify',primary:true}], onProcess: v => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') });
  }
});

FL.registerTool({
  id:'lorem', name:'Lorem Ipsum', desc:'Generate placeholder text (paragraphs, sentences, words).', icon:'¶', category:'generator', privacy:'local', tags:['lorem','placeholder'],
  mount(m){
    const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure dolor reprehenderit voluptate velit esse cillum'.split(' ');
    const rw = (n) => Array.from({length:n}, ()=>words[Math.floor(Math.random()*words.length)]).join(' ');
    m.innerHTML = `<div class="grid grid-3" style="margin-bottom:10px">
      <div class="field"><label>Paragraphs</label><input id="lP" type="number" value="3" min="1" max="20"/></div>
      <div class="field"><label>Sentences per para</label><input id="lS" type="number" value="4" min="1" max="20"/></div>
      <div class="field"><label>Words per sentence</label><input id="lW" type="number" value="10" min="3" max="30"/></div>
    </div>
    <button class="btn btn-primary btn-sm" id="lGo">Generate</button>
    <textarea id="lOut" rows="14" style="margin-top:12px" readonly></textarea>`;
    const gen = () => {
      const p=+$('#lP',m).value, s=+$('#lS',m).value, w=+$('#lW',m).value;
      const paras = [];
      for (let i=0;i<p;i++){
        const sent = []; for (let j=0;j<s;j++){ const t = rw(w); sent.push(t[0].toUpperCase()+t.slice(1)+'.'); }
        paras.push(sent.join(' '));
      }
      $('#lOut',m).value = paras.join('\n\n');
    };
    $('#lGo',m).addEventListener('click',gen); gen();
  }
});

FL.registerTool({
  id:'markdown-preview', name:'Markdown Preview', desc:'Live markdown → HTML preview (subset: headings, bold/italic, lists, code, links).', icon:'M↓', category:'text', privacy:'local', tags:['markdown','md','preview'],
  mount(m){
    m.innerHTML = `<div class="tool-body tool-split">
      <div class="field"><label>Markdown</label><textarea id="mIn" rows="20"># Hello

**Bold** and *italic*.

- item 1
- item 2

\code\ and [link](https://example.com)</textarea></div>
      <div class="field"><label>Preview</label><div id="mOut" class="card" style="min-height:400px;background:#fff;color:#111;padding:16px"></div></div>
    </div>`;
    const render = (md) => {
      let h = esc(md);
      h = h.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>');
      h = h.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>');
      h = h.replace(/`([^`]+)`/g,'<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px">$1</code>');
      h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" style="color:#0369a1">$1</a>');
      h = h.replace(/^- (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
      h = h.replace(/\n\n/g,'</p><p>').replace(/^/,'<p>')+'</p>';
      $('#mOut',m).innerHTML = h;
    };
    const upd = () => render($('#mIn',m).value);
    $('#mIn',m).addEventListener('input', debounce(upd,150)); upd();
  }
});

/* ---------- DATA TOOLS ---------- */

FL.registerTool({
  id:'yaml-json', name:'YAML ⇄ JSON', desc:'Convert between JSON and simple YAML (subset).', icon:'⇆', category:'data', privacy:'local', tags:['yaml','json'],
  mount(m){
    m.innerHTML = `<div class="tool-body tool-split">
      <div class="field"><label>YAML</label><textarea id="yY" rows="14"></textarea></div>
      <div class="field"><label>JSON</label><textarea id="yJ" rows="14"></textarea></div>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px"><button class="btn btn-primary btn-sm" id="yYtoJ">YAML → JSON</button><button class="btn btn-ghost btn-sm" id="yJtoY">JSON → YAML</button></div>`;
    const yamlToJson = (s) => {
      // very simple: flat & nested key: value, lists starting with -
      const lines = s.split('\n').filter(l=>l.trim() && !l.trim().startsWith('#'));
      const root = {};
      const stack = [{ind:-1, obj:root}];
      for (const line of lines){
        const ind = line.match(/^ */)[0].length;
        while (stack.length && stack[stack.length-1].ind >= ind) stack.pop();
        const parent = stack[stack.length-1].obj;
        const trim = line.trim();
        if (trim.startsWith('- ')){
          if (!Array.isArray(parent.__list)) parent.__list = [];
          parent.__list.push(parseVal(trim.slice(2)));
        } else {
          const [k,...rest] = trim.split(':'); const v = rest.join(':').trim();
          if (v){ parent[k]=parseVal(v); } else { parent[k]={}; stack.push({ind, obj:parent[k]}); }
        }
      }
      const norm = (o) => { if (Array.isArray(o)) return o.map(norm); if (o && typeof o==='object'){ if (o.__list) return o.__list.map(norm); return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,norm(v)])); } return o; };
      function parseVal(s){ if (s==='true') return true; if (s==='false') return false; if (s==='null'||s==='~') return null; if (!isNaN(+s) && s.trim()!=='') return +s; return s.replace(/^["']|["']$/g,''); }
      return JSON.stringify(norm(root), null, 2);
    };
    const jsonToYaml = (obj, ind=0) => {
      const pad = '  '.repeat(ind);
      if (Array.isArray(obj)) return obj.map(v=>pad+'- '+ (typeof v==='object' ? '\n'+jsonToYaml(v, ind+1) : v)).join('\n');
      if (obj && typeof obj==='object') return Object.entries(obj).map(([k,v])=> typeof v==='object' && v!==null ? `${pad}${k}:\n${jsonToYaml(v, ind+1)}` : `${pad}${k}: ${v}`).join('\n');
      return String(obj);
    };
    $('#yYtoJ',m).addEventListener('click',()=>{ try{ $('#yJ',m).value = yamlToJson($('#yY',m).value); } catch(e){ FL.toast('YAML parse failed: '+e.message,'err'); } });
    $('#yJtoY',m).addEventListener('click',()=>{ try{ $('#yY',m).value = jsonToYaml(JSON.parse($('#yJ',m).value)); } catch(e){ FL.toast('JSON parse failed: '+e.message,'err'); } });
  }
});

FL.registerTool({
  id:'csv-viewer', name:'CSV Viewer', desc:'Drop a CSV file to preview it as a searchable table.', icon:'📊', category:'data', privacy:'local', tags:['csv','table','preview'],
  mount(m){
    m.innerHTML = `<div class="dropzone" id="cvDrop"><div class="icon">📊</div>Drop a CSV file here, or <b>click to browse</b></div>
    <input type="file" id="cvFile" accept=".csv,.tsv,text/csv" style="display:none"/>
    <input id="cvSearch" placeholder="Search rows…" style="margin-top:10px"/>
    <div id="cvOut" style="margin-top:12px;overflow:auto;max-height:520px;border:1px solid var(--line);border-radius:8px"></div>`;
    let rows=[], head=[];
    const parseCSV = (text) => {
      const out=[]; let row=[], cur='', inQ=false;
      for (let i=0;i<text.length;i++){ const c=text[i], n=text[i+1];
        if (inQ){ if(c==='"'&&n==='"'){cur+='"';i++;} else if(c==='"'){inQ=false;} else cur+=c; }
        else { if(c==='"')inQ=true; else if(c===','||c==='\t'){row.push(cur);cur='';} else if(c==='\n'||c==='\r'){ if(c==='\r'&&n==='\n')i++; row.push(cur); out.push(row); row=[]; cur=''; } else cur+=c; }
      }
      if(cur||row.length){row.push(cur); out.push(row);}
      return out;
    };
    const paint = (filter='') => {
      const f = filter.toLowerCase();
      const filtered = f ? rows.filter(r=>r.some(c=>String(c).toLowerCase().includes(f))) : rows;
      $('#cvOut',m).innerHTML = `<table class="tbl"><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${filtered.slice(0,500).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` + (filtered.length>500?`<div class="muted" style="padding:10px">Showing first 500 of ${filtered.length}</div>`:'');
    };
    const load = async (file) => {
      const t = await readFile(file,'text');
      const p = parseCSV(t);
      head = p[0]||[]; rows = p.slice(1).filter(r=>r.some(v=>v!==''));
      paint();
    };
    $('#cvDrop',m).addEventListener('click',()=>$('#cvFile',m).click());
    $('#cvDrop',m).addEventListener('dragover',e=>{e.preventDefault(); e.currentTarget.classList.add('drag');});
    $('#cvDrop',m).addEventListener('dragleave',e=>e.currentTarget.classList.remove('drag'));
    $('#cvDrop',m).addEventListener('drop',e=>{ e.preventDefault(); e.currentTarget.classList.remove('drag'); if(e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
    $('#cvFile',m).addEventListener('change',e=>{ if(e.target.files[0]) load(e.target.files[0]); });
    $('#cvSearch',m).addEventListener('input',debounce(e=>paint(e.target.value),150));
  }
});

FL.registerTool({
  id:'sql-playground', name:'SQL Playground (SQLite)', desc:'Run SQL against an in-browser SQLite database — no upload.', icon:'🗄', category:'data', privacy:'local', tags:['sql','sqlite','query'],
  mount(m){
    m.innerHTML = `<div class="note ok">Loading sql.js (WebAssembly) once…</div>
    <div class="field" style="margin-top:12px"><label>SQL</label><textarea id="sqlIn" rows="8">CREATE TABLE users (id INTEGER, name TEXT, age INTEGER);
INSERT INTO users VALUES (1,'Alice',30),(2,'Bob',25);
SELECT * FROM users;</textarea></div>
    <div style="margin-top:8px;display:flex;gap:8px"><button class="btn btn-primary btn-sm" id="sqlRun" disabled>Run</button></div>
    <div id="sqlOut" style="margin-top:12px"></div>`;
    let db;
    (async ()=>{
      try {
        const initSqlJs = (await import('https://esm.sh/sql.js@1.10.3')).default;
        const SQL = await initSqlJs({ locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}` });
        db = new SQL.Database();
        m.querySelector('.note').outerHTML = '<div class="note ok">✓ SQLite ready. No data leaves your browser.</div>';
        $('#sqlRun',m).disabled = false;
      } catch(e){ m.querySelector('.note').outerHTML = `<div class="note err">Failed to load sql.js: ${esc(e.message)}</div>`; }
    })();
    $('#sqlRun',m).addEventListener('click',()=>{
      const sql = $('#sqlIn',m).value;
      try {
        const res = db.exec(sql);
        if (!res.length){ $('#sqlOut',m).innerHTML = '<div class="note ok">Executed. No rows returned.</div>'; return; }
        $('#sqlOut',m).innerHTML = res.map(r=>`<div style="overflow:auto;border:1px solid var(--line);border-radius:8px;margin-top:10px"><table class="tbl"><thead><tr>${r.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.values.slice(0,500).map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('');
      } catch(e){ $('#sqlOut',m).innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
    });
  }
});

/* ---------- IMAGE TOOLS ---------- */

FL.registerTool({
  id:'qr-gen', name:'QR Code Generator', desc:'Turn any text or URL into a downloadable PNG QR code.', icon:'▣', category:'generator', privacy:'local', tags:['qr','qrcode'],
  mount(m){
    m.innerHTML = `<div class="grid grid-2">
      <div class="field"><label>Content</label><textarea id="qIn" rows="6" placeholder="https://example.com or any text…">https://FCMA.dev</textarea>
        <div style="display:flex;gap:8px;margin-top:8px"><input id="qSize" type="number" value="320" min="128" max="1024" style="width:110px"/><span class="muted" style="align-self:center">px</span></div>
        <div style="margin-top:8px"><button class="btn btn-primary btn-sm" id="qGo">Generate</button> <button class="btn btn-ghost btn-sm" id="qDl">Download PNG</button></div></div>
      <div style="display:flex;justify-content:center;align-items:center;background:#fff;border-radius:12px;padding:14px"><canvas id="qCan" width="320" height="320"></canvas></div>
    </div>`;
    let QR;
    const gen = async () => {
      if (!QR) QR = (await import('https://esm.sh/qrcode@1.5.3')).default;
      const size = +$('#qSize',m).value;
      const can = $('#qCan',m); can.width=can.height=size;
      await QR.toCanvas(can, $('#qIn',m).value || ' ', { width:size, margin:1, color:{dark:'#000000',light:'#ffffff'} });
    };
    $('#qGo',m).addEventListener('click',gen);
    $('#qDl',m).addEventListener('click',()=>{ $('#qCan',m).toBlob(b=>download(b,'qrcode.png')); });
    gen();
  }
});

FL.registerTool({
  id:'image-compress', name:'Image Compressor / Resizer', desc:'Compress JPG/PNG/WebP and resize to target dimensions — all local.', icon:'🗜', category:'image', privacy:'local', tags:['image','compress','resize'],
  mount(m){
    m.innerHTML = `<div class="dropzone" id="iDrop"><div class="icon">🖼️</div>Drop an image or click to browse</div>
    <input type="file" id="iFile" accept="image/*" style="display:none"/>
    <div id="iCtl" style="display:none;margin-top:14px">
      <div class="grid grid-3">
        <div class="field"><label>Max width (px)</label><input id="iW" type="number" value="1600"/></div>
        <div class="field"><label>Quality (0-1)</label><input id="iQ" type="number" step="0.05" value="0.85" min="0.1" max="1"/></div>
        <div class="field"><label>Format</label><select id="iFmt"><option>image/jpeg</option><option>image/webp</option><option>image/png</option></select></div>
      </div>
      <button class="btn btn-primary" id="iGo" style="margin-top:10px">Process</button>
      <div id="iOut" style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px"></div>
    </div>`;
    let img, origSize=0, origName='';
    const load = (file) => {
      origSize = file.size; origName = file.name;
      const url = URL.createObjectURL(file);
      img = new Image(); img.onload = () => { $('#iCtl',m).style.display=''; render(); URL.revokeObjectURL(url); };
      img.src = url;
    };
    const render = () => {
      const w = Math.min(img.width, +$('#iW',m).value||img.width);
      const h = Math.round(img.height * w / img.width);
      const c = document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        $('#iOut',m).innerHTML = `<div class="card"><div class="muted" style="font-size:12px">Original</div><img src="${img.src}" style="max-width:100%;border-radius:8px;margin-top:6px"/><div style="margin-top:6px">${img.width}×${img.height} · ${fmtBytes(origSize)}</div></div>
        <div class="card"><div class="muted" style="font-size:12px">Result</div><img src="${url}" style="max-width:100%;border-radius:8px;margin-top:6px"/><div style="margin-top:6px">${w}×${h} · ${fmtBytes(blob.size)} · <b>${(100-blob.size/origSize*100).toFixed(0)}%</b> smaller</div><button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="const a=document.createElement('a');a.href='${url}';a.download='compressed.${$('#iFmt',m).value.split('/')[1]}';a.click()">Download</button></div>`;
      }, $('#iFmt',m).value, +$('#iQ',m).value);
    };
    $('#iDrop',m).addEventListener('click',()=>$('#iFile',m).click());
    $('#iDrop',m).addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('drag');});
    $('#iDrop',m).addEventListener('dragleave',e=>e.currentTarget.classList.remove('drag'));
    $('#iDrop',m).addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('drag'); if(e.dataTransfer.files[0]) load(e.dataTransfer.files[0]);});
    $('#iFile',m).addEventListener('change',e=>{ if(e.target.files[0]) load(e.target.files[0]); });
    $('#iGo',m).addEventListener('click',render);
  }
});

FL.registerTool({
  id:'image-to-b64', name:'Image ⇄ Base64', desc:'Convert images to data URLs and back.', icon:'📦', category:'image', privacy:'local', tags:['base64','image','dataurl'],
  mount(m){
    m.innerHTML = `<div class="dropzone" id="iDrop"><div class="icon">🖼️</div>Drop an image or click to browse</div>
    <input type="file" id="iFile" accept="image/*" style="display:none"/>
    <div class="field" style="margin-top:14px"><label>Data URL</label><textarea id="iOut" rows="8" readonly></textarea></div>
    <button class="btn btn-ghost btn-sm" onclick="FL.util.copy(document.getElementById('iOut').value)">Copy</button>`;
    const load = async (f) => { $('#iOut',m).value = await readFile(f,'dataurl'); };
    $('#iDrop',m).addEventListener('click',()=>$('#iFile',m).click());
    $('#iFile',m).addEventListener('change',e=>{if(e.target.files[0])load(e.target.files[0]);});
  }
});

/* ---------- FILE / PDF TOOLS ---------- */

FL.registerTool({
  id:'pdf-merge', name:'PDF Merge', desc:'Combine multiple PDF files into one — locally.', icon:'📎', category:'file', privacy:'local', tags:['pdf','merge','combine'],
  mount(m){
    m.innerHTML = `<div class="note ok">PDFs stay in your browser — never uploaded.</div>
    <div class="dropzone" id="pDrop" style="margin-top:14px"><div class="icon">📄</div>Drop PDFs here, or click to browse (multiple)</div>
    <input type="file" id="pFile" accept="application/pdf" multiple style="display:none"/>
    <div id="pList" style="margin-top:12px"></div>
    <button class="btn btn-primary" id="pGo" style="margin-top:10px" disabled>Merge & download</button>`;
    let files = [];
    const paint = () => {
      $('#pList',m).innerHTML = files.length ? files.map((f,i)=>`<div class="cv-file-item"><span>📄</span><span class="n">${esc(f.name)}</span><span class="m">${fmtBytes(f.size)}</span><button class="btn btn-ghost btn-sm" data-up="${i}">↑</button><button class="btn btn-ghost btn-sm" data-dn="${i}">↓</button><button class="btn btn-danger btn-sm" data-rm="${i}">✕</button></div>`).join('') : '<div class="empty">No files yet</div>';
      $('#pGo',m).disabled = files.length < 2;
      $$('#pList [data-up]',m).forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.up; if(i>0){[files[i-1],files[i]]=[files[i],files[i-1]]; paint();}}));
      $$('#pList [data-dn]',m).forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.dn; if(i<files.length-1){[files[i+1],files[i]]=[files[i],files[i+1]]; paint();}}));
      $$('#pList [data-rm]',m).forEach(b=>b.addEventListener('click',()=>{files.splice(+b.dataset.rm,1); paint();}));
    };
    const add = (fl) => { files.push(...[...fl].filter(f=>f.type==='application/pdf')); paint(); };
    $('#pDrop',m).addEventListener('click',()=>$('#pFile',m).click());
    $('#pDrop',m).addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('drag');});
    $('#pDrop',m).addEventListener('dragleave',e=>e.currentTarget.classList.remove('drag'));
    $('#pDrop',m).addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('drag');add(e.dataTransfer.files);});
    $('#pFile',m).addEventListener('change',e=>add(e.target.files));
    $('#pGo',m).addEventListener('click',async ()=>{
      const btn = $('#pGo',m); btn.disabled=true; btn.innerHTML='<span class="spin"></span> Merging…';
      try {
        const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
        const out = await PDFDocument.create();
        for (const f of files){
          const src = await PDFDocument.load(await readFile(f,'binary'));
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach(p=>out.addPage(p));
        }
        const bytes = await out.save();
        download(new Blob([bytes],{type:'application/pdf'}), 'merged.pdf');
      } catch(e){ FL.toast('Merge failed: '+e.message,'err'); }
      btn.disabled=false; btn.innerHTML='Merge & download';
    });
    paint();
  }
});

FL.registerTool({
  id:'pdf-split', name:'PDF Split / Extract Pages', desc:'Extract specific pages from a PDF as a new file.', icon:'✂', category:'file', privacy:'local', tags:['pdf','split','extract'],
  mount(m){
    m.innerHTML = `<input type="file" id="pFile" accept="application/pdf"/>
    <div class="field" style="margin-top:10px"><label>Pages to extract (e.g. 1,3-5,8)</label><input id="pRange" placeholder="1,3-5"/></div>
    <button class="btn btn-primary" id="pGo" style="margin-top:10px">Extract & download</button>
    <div id="pInfo" style="margin-top:10px" class="muted"></div>`;
    let bytes;
    $('#pFile',m).addEventListener('change',async e=>{
      const f = e.target.files[0]; if (!f) return;
      bytes = await readFile(f,'binary');
      const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
      const doc = await PDFDocument.load(bytes);
      $('#pInfo',m).textContent = `${f.name} · ${doc.getPageCount()} pages`;
    });
    $('#pGo',m).addEventListener('click',async ()=>{
      if (!bytes){ FL.toast('Load a PDF first','warn'); return; }
      const range = $('#pRange',m).value;
      try {
        const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
        const doc = await PDFDocument.load(bytes);
        const total = doc.getPageCount();
        const pages = [];
        for (const part of range.split(',')){
          if (part.includes('-')){ const [a,b] = part.split('-').map(x=>+x); for (let i=a;i<=b;i++) pages.push(i-1); }
          else pages.push(+part-1);
        }
        const bad = pages.find(p=>p<0||p>=total);
        if (bad!=null) throw new Error(`Page ${bad+1} out of range (1-${total})`);
        const out = await PDFDocument.create();
        const copied = await out.copyPages(doc, pages);
        copied.forEach(p=>out.addPage(p));
        download(new Blob([await out.save()],{type:'application/pdf'}), 'extracted.pdf');
      } catch(e){ FL.toast('Failed: '+e.message,'err'); }
    });
  }
});

FL.registerTool({
  id:'pdf-rotate', name:'PDF Rotate', desc:'Rotate all pages of a PDF by 90/180/270 degrees.', icon:'↻', category:'file', privacy:'local', tags:['pdf','rotate'],
  mount(m){
    m.innerHTML = `<input type="file" id="pFile" accept="application/pdf"/>
    <div style="display:flex;gap:8px;margin-top:10px">${[90,180,270].map(a=>`<button class="btn btn-ghost btn-sm" data-r="${a}">Rotate ${a}°</button>`).join('')}</div>
    <div id="pInfo" class="muted" style="margin-top:10px"></div>`;
    let bytes, name='rotated.pdf';
    $('#pFile',m).addEventListener('change',async e=>{ const f=e.target.files[0]; if(!f)return; bytes = await readFile(f,'binary'); name = f.name.replace(/\.pdf$/i,'-rotated.pdf'); $('#pInfo',m).textContent = f.name+' loaded'; });
    $$('[data-r]',m).forEach(b=>b.addEventListener('click',async ()=>{
      if (!bytes){ FL.toast('Load a PDF','warn'); return; }
      const { PDFDocument, degrees } = await import('https://esm.sh/pdf-lib@1.17.1');
      const doc = await PDFDocument.load(bytes);
      doc.getPages().forEach(p=>p.setRotation(degrees(p.getRotation().angle + +b.dataset.r)));
      download(new Blob([await doc.save()],{type:'application/pdf'}), name);
    }));
  }
});

FL.registerTool({
  id:'pdf-images', name:'Images → PDF', desc:'Combine JPG/PNG images into a single PDF.', icon:'🖼', category:'file', privacy:'local', tags:['pdf','images','convert'],
  mount(m){
    m.innerHTML = `<input type="file" id="pFile" accept="image/jpeg,image/png" multiple/>
    <button class="btn btn-primary" id="pGo" style="margin-top:10px">Build PDF</button>
    <div id="pInfo" class="muted" style="margin-top:10px"></div>`;
    let files=[];
    $('#pFile',m).addEventListener('change',e=>{ files=[...e.target.files]; $('#pInfo',m).textContent = files.length+' images loaded'; });
    $('#pGo',m).addEventListener('click',async ()=>{
      if (!files.length){ FL.toast('Choose images first','warn'); return; }
      const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
      const doc = await PDFDocument.create();
      for (const f of files){
        const bytes = new Uint8Array(await readFile(f,'binary'));
        const img = f.type.includes('png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const p = doc.addPage([img.width, img.height]);
        p.drawImage(img, {x:0,y:0,width:img.width,height:img.height});
      }
      download(new Blob([await doc.save()],{type:'application/pdf'}), 'images.pdf');
    });
  }
});

FL.registerTool({
  id:'pdf-metadata', name:'PDF Metadata Viewer / Cleaner', desc:'Inspect PDF metadata (title, author, dates) and optionally strip it.', icon:'ℹ', category:'file', privacy:'local', tags:['pdf','metadata','privacy'],
  mount(m){
    m.innerHTML = `<input type="file" id="pFile" accept="application/pdf"/>
    <pre id="pOut" class="card mono" style="margin-top:12px;white-space:pre-wrap"></pre>
    <button class="btn btn-primary btn-sm" id="pClean" style="margin-top:8px" disabled>Download cleaned PDF</button>`;
    let bytes;
    $('#pFile',m).addEventListener('change',async e=>{ const f=e.target.files[0]; if(!f)return; bytes = await readFile(f,'binary');
      const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
      const doc = await PDFDocument.load(bytes);
      $('#pOut',m).textContent = JSON.stringify({title:doc.getTitle(),author:doc.getAuthor(),subject:doc.getSubject(),keywords:doc.getKeywords(),creator:doc.getCreator(),producer:doc.getProducer(),creationDate:doc.getCreationDate()?.toISOString(),modificationDate:doc.getModificationDate()?.toISOString(),pages:doc.getPageCount()},null,2);
      $('#pClean',m).disabled=false;
    });
    $('#pClean',m).addEventListener('click',async ()=>{
      const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
      const doc = await PDFDocument.load(bytes);
      doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setCreator(''); doc.setProducer('');
      download(new Blob([await doc.save()],{type:'application/pdf'}), 'cleaned.pdf');
    });
  }
});

FL.registerTool({
  id:'pdf-watermark', name:'PDF Watermark', desc:'Add a diagonal text watermark to every page of a PDF.', icon:'💧', category:'file', privacy:'local', tags:['pdf','watermark'],
  mount(m){
    m.innerHTML = `<input type="file" id="pFile" accept="application/pdf"/>
    <div class="grid grid-2" style="margin-top:10px"><div class="field"><label>Text</label><input id="pText" value="CONFIDENTIAL"/></div><div class="field"><label>Opacity (0-1)</label><input id="pOp" type="number" step="0.1" value="0.3" min="0" max="1"/></div></div>
    <button class="btn btn-primary" id="pGo" style="margin-top:10px">Add watermark & download</button>`;
    $('#pGo',m).addEventListener('click',async ()=>{
      const f = $('#pFile',m).files[0]; if(!f){ FL.toast('Choose a PDF','warn'); return; }
      const { PDFDocument, StandardFonts, rgb, degrees } = await import('https://esm.sh/pdf-lib@1.17.1');
      const doc = await PDFDocument.load(await readFile(f,'binary'));
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const text = $('#pText',m).value || 'WATERMARK'; const op = +$('#pOp',m).value;
      doc.getPages().forEach(p=>{
        const { width, height } = p.getSize();
        p.drawText(text, { x:width/2-100, y:height/2, size:60, font, color:rgb(1,0,0), opacity:op, rotate:degrees(45) });
      });
      download(new Blob([await doc.save()],{type:'application/pdf'}), 'watermarked.pdf');
    });
  }
});

/* ---------- NETWORK TOOLS ---------- */

FL.registerTool({
  id:'url-parser', name:'URL Parser', desc:'Break a URL into scheme, host, path, query, hash.', icon:'🔗', category:'network', privacy:'local', tags:['url','parse'],
  mount(m){
    m.innerHTML = `<input id="uIn" placeholder="https://example.com/path?q=1#top" value="https://example.com:8080/a/b?x=1&y=2#top"/>
    <pre id="uOut" class="card mono" style="margin-top:14px;white-space:pre-wrap;font-size:13px"></pre>`;
    const run = () => {
      try { const u = new URL($('#uIn',m).value);
        $('#uOut',m).textContent = JSON.stringify({protocol:u.protocol,host:u.host,hostname:u.hostname,port:u.port,pathname:u.pathname,search:u.search,searchParams:Object.fromEntries(u.searchParams),hash:u.hash,origin:u.origin}, null, 2);
      } catch(e){ $('#uOut',m).textContent = 'Invalid URL: '+e.message; }
    };
    $('#uIn',m).addEventListener('input', debounce(run,150)); run();
  }
});

FL.registerTool({
  id:'dns-lookup', name:'DNS Lookup', desc:'Query DNS records via Cloudflare DoH.', icon:'🌐', category:'network', privacy:'remote', tags:['dns','lookup'],
  mount(m){
    m.innerHTML = `<div class="note warn">Queries go to Cloudflare's public DNS-over-HTTPS (1.1.1.1). The domain you enter is visible to Cloudflare.</div>
    <div style="display:flex;gap:8px;margin-top:12px"><input id="dIn" placeholder="example.com" value="cloudflare.com" style="flex:1"/>
      <select id="dT" style="width:120px"><option>A</option><option>AAAA</option><option>MX</option><option>TXT</option><option>NS</option><option>CNAME</option></select>
      <button class="btn btn-primary" id="dGo">Lookup</button></div>
    <pre id="dOut" class="card mono" style="margin-top:12px;white-space:pre-wrap"></pre>`;
    $('#dGo',m).addEventListener('click',async ()=>{
      const dom = $('#dIn',m).value.trim(); const type = $('#dT',m).value;
      $('#dOut',m).textContent = 'Querying…';
      try {
        const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dom)}&type=${type}`, { headers:{Accept:'application/dns-json'} });
        const j = await r.json();
        $('#dOut',m).textContent = JSON.stringify(j, null, 2);
      } catch(e){ $('#dOut',m).textContent = 'Error: '+e.message; }
    });
  }
});

FL.registerTool({
  id:'user-agent', name:'User Agent Parser', desc:'Inspect your browser\'s User-Agent string.', icon:'🖥', category:'network', privacy:'local', tags:['user-agent','browser'],
  mount(m){
    const ua = navigator.userAgent;
    m.innerHTML = `<div class="card"><h3>Your User-Agent</h3><pre class="mono" style="white-space:pre-wrap;margin-top:10px">${esc(ua)}</pre></div>
    <div class="card" style="margin-top:12px"><h3>Detected</h3>
      <ul style="line-height:2"><li>Platform: <b>${esc(navigator.platform)}</b></li><li>Language: <b>${esc(navigator.language)}</b></li><li>Cores: <b>${navigator.hardwareConcurrency}</b></li><li>Memory (GB): <b>${navigator.deviceMemory??'—'}</b></li><li>Cookie enabled: <b>${navigator.cookieEnabled}</b></li><li>Screen: <b>${screen.width}×${screen.height}</b></li></ul>
    </div>`;
  }
});

FL.registerTool({
  id:'http-status', name:'HTTP Status Codes', desc:'Quick reference for all HTTP status codes.', icon:'ℹ', category:'network', privacy:'local', tags:['http','status'],
  mount(m){
    const codes = {'1xx Informational':{100:'Continue',101:'Switching Protocols',103:'Early Hints'},'2xx Success':{200:'OK',201:'Created',202:'Accepted',204:'No Content',206:'Partial Content'},'3xx Redirection':{301:'Moved Permanently',302:'Found',304:'Not Modified',307:'Temporary Redirect',308:'Permanent Redirect'},'4xx Client Error':{400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',408:'Timeout',409:'Conflict',410:'Gone',418:"I'm a teapot",422:'Unprocessable',429:'Too Many Requests'},'5xx Server Error':{500:'Internal Server Error',501:'Not Implemented',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout'}};
    m.innerHTML = Object.entries(codes).map(([g,list])=>`<div class="card" style="margin-bottom:10px"><h3>${g}</h3><div style="margin-top:8px;display:grid;grid-template-columns:80px 1fr;gap:6px;font-size:13.5px">${Object.entries(list).map(([c,t])=>`<div class="mono" style="color:var(--accent)">${c}</div><div>${t}</div>`).join('')}</div></div>`).join('');
  }
});

FL.registerTool({
  id:'curl-gen', name:'cURL Generator', desc:'Build a cURL command interactively.', icon:'⚡', category:'network', privacy:'local', tags:['curl','http'],
  mount(m){
    m.innerHTML = `<div class="grid grid-2">
      <div class="field"><label>Method</label><select id="cM"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></div>
      <div class="field"><label>URL</label><input id="cU" value="https://api.example.com/v1/users"/></div>
    </div>
    <div class="field" style="margin-top:10px"><label>Headers (one per line: Key: value)</label><textarea id="cH" rows="3">Content-Type: application/json
Authorization: ******</textarea></div>
    <div class="field" style="margin-top:10px"><label>Body (JSON)</label><textarea id="cB" rows="4">{"name":"Alice"}</textarea></div>
    <div class="field" style="margin-top:10px"><label>cURL</label><textarea id="cOut" rows="8" readonly class="mono"></textarea></div>`;
    const build = () => {
      const method = $('#cM',m).value; const url = $('#cU',m).value; const body = $('#cB',m).value.trim();
      const headers = $('#cH',m).value.split('\n').filter(l=>l.includes(':')).map(l=>`  -H "${l.trim().replace(/"/g,'\\"')}"`).join(' \\\n');
      const parts = [`curl -X ${method} "${url}"`];
      if (headers) parts.push(headers);
      if (body && method!=='GET') parts.push(`  -d '${body.replace(/'/g,"'\\''")}'`);
      $('#cOut',m).value = parts.join(' \\\n');
    };
    ['input','change'].forEach(ev => $$('#cM,#cU,#cH,#cB',m).forEach(n => n.addEventListener(ev, build)));
    build();
  }
});

}; // end registerAllTools
