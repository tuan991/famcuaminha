/* ============================================================
   FCMA — Core app
   Router, storage, palette, theme, tool registry, toast
   ============================================================ */

const FL = window.FL = {};
FL.version = '0.1.0';

/* ---------- utils ---------- */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const el = (tag, attrs={}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (k==='class') n.className=v;
    else if (k==='style' && typeof v==='object') Object.assign(n.style,v);
    else if (k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2).toLowerCase(),v);
    else if (v!=null && v!==false) n.setAttribute(k,v===true?'':v);
  }
  for (const k of kids.flat()){
    if (k==null||k===false) continue;
    n.append(typeof k==='string'||typeof k==='number' ? document.createTextNode(k) : k);
  }
  return n;
};
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {href:url, download:name});
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
};
const copy = async (text) => { try{ await navigator.clipboard.writeText(text); FL.toast('Copied to clipboard','ok'); }catch(e){ FL.toast('Copy failed: '+e.message,'err'); } };
const readFile = (file, mode='text') => new Promise((res,rej)=>{
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  if (mode==='text') r.readAsText(file);
  else if (mode==='binary') r.readAsArrayBuffer(file);
  else if (mode==='dataurl') r.readAsDataURL(file);
});
const fmtBytes = n => { if(n<1024)return n+' B'; if(n<1048576)return (n/1024).toFixed(1)+' KB'; if(n<1073741824)return (n/1048576).toFixed(1)+' MB'; return (n/1073741824).toFixed(2)+' GB'; };
const fmtDate = ts => { const d=new Date(ts); const now=Date.now(); const diff=(now-ts)/1000; if(diff<60)return 'just now'; if(diff<3600)return Math.floor(diff/60)+'m ago'; if(diff<86400)return Math.floor(diff/3600)+'h ago'; if(diff<7*86400)return Math.floor(diff/86400)+'d ago'; return d.toLocaleDateString(); };
const uid = () => Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const debounce = (fn,ms=300) => { let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);}; };

FL.util = { $, $$, el, esc, download, copy, readFile, fmtBytes, fmtDate, uid, debounce };

/* ---------- Toast ---------- */
FL.toast = (msg, kind='') => {
  const t = el('div', {class:'toast '+kind}, msg);
  $('#toastHost').appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 2500);
};

/* ---------- Theme ---------- */
FL.theme = {
  get(){ return localStorage.getItem('fl-theme') || 'dark'; },
  set(t){ localStorage.setItem('fl-theme', t); document.documentElement.setAttribute('data-theme', t); },
  toggle(){ this.set(this.get()==='dark'?'light':'dark'); }
};
FL.theme.set(FL.theme.get());

/* ---------- Storage (IndexedDB via Dexie) ---------- */
FL.db = null;
FL.initDB = async () => {
  // wait for Dexie
  let tries=0;
  while (!window.Dexie && tries<50){ await new Promise(r=>setTimeout(r,50)); tries++; }
  if (!window.Dexie){ console.warn('Dexie not loaded; falling back to localStorage only'); return; }
  const db = new Dexie('FCMA');
  db.version(1).stores({
    cvs: '&id, name, updatedAt, createdAt',
    tools_data: '&id, tool, updatedAt',   // per-tool user data (e.g., saved snippets)
    projects: '&id, name, updatedAt',
    favorites: '&toolId',
    recents: '&toolId, ts',
    settings: '&key',
    builtTools: '&id, name, updatedAt',
    tool_chains: '&id, name, updatedAt'
  });
  FL.db = db;
};

/* ---------- Favorites & Recents ---------- */
FL.favs = {
  cache: new Set(JSON.parse(localStorage.getItem('fl-favs')||'[]')),
  has(id){ return this.cache.has(id); },
  toggle(id){
    if (this.cache.has(id)) this.cache.delete(id); else this.cache.add(id);
    localStorage.setItem('fl-favs', JSON.stringify([...this.cache]));
    return this.cache.has(id);
  },
  list(){ return [...this.cache]; }
};
FL.recents = {
  get(){ return JSON.parse(localStorage.getItem('fl-recents')||'[]'); },
  add(id){
    let r = this.get().filter(x=>x!==id);
    r.unshift(id);
    r = r.slice(0,15);
    localStorage.setItem('fl-recents', JSON.stringify(r));
  }
};

/* ---------- Router ---------- */
FL.routes = {};
FL.route = (path, handler) => { FL.routes[path] = handler; };
FL.match = (hash) => {
  hash = hash || '#/';
  const path = hash.slice(1) || '/';
  // exact
  if (FL.routes[path]) return { handler: FL.routes[path], params: {} };
  // parametric: /tools/:id
  for (const pat of Object.keys(FL.routes)){
    if (!pat.includes(':')) continue;
    const patParts = pat.split('/');
    const pParts = path.split('/');
    if (patParts.length !== pParts.length) continue;
    const params={}; let ok=true;
    for (let i=0;i<patParts.length;i++){
      if (patParts[i].startsWith(':')) params[patParts[i].slice(1)] = decodeURIComponent(pParts[i]);
      else if (patParts[i] !== pParts[i]){ ok=false; break; }
    }
    if (ok) return { handler: FL.routes[pat], params };
  }
  return { handler: FL.routes['/404'] || (()=>FL.notFound()), params:{} };
};
FL.notFound = () => {
  $('#view').innerHTML = `<div class="container-sm"><h1>404</h1><p class="muted" style="margin-top:8px">This page doesn't exist yet.</p><p style="margin-top:20px"><a class="btn btn-primary" href="#/">Go home</a></p></div>`;
};
FL.render = () => {
  const { handler, params } = FL.match(location.hash);
  window.scrollTo(0,0);
  $$('#nav a').forEach(a => a.classList.toggle('active', location.hash.startsWith(a.getAttribute('href'))));
  Promise.resolve(handler(params)).catch(err => {
    console.error(err);
    $('#view').innerHTML = `<div class="container-sm"><h1>Error</h1><pre class="mono" style="color:var(--err);white-space:pre-wrap">${esc(err.stack||err.message)}</pre></div>`;
  });
};
FL.go = (hash) => { location.hash = hash; };

window.addEventListener('hashchange', FL.render);

/* ---------- Tool Registry ---------- */
FL.tools = [];   // filled by tools.js
FL.categories = [
  { id:'developer', name:'Developer', icon:'💻', color:'#60a5fa' },
  { id:'text',      name:'Text',      icon:'📝', color:'#4ade80' },
  { id:'data',      name:'Data',      icon:'📊', color:'#fbbf24' },
  { id:'file',      name:'File & PDF',icon:'📄', color:'#f87171' },
  { id:'image',     name:'Image',     icon:'🖼️', color:'#a78bfa' },
  { id:'network',   name:'Network',   icon:'🌐', color:'#22d3ee' },
  { id:'generator', name:'Generator', icon:'✨', color:'#ff8a4d' },
  { id:'ai',        name:'AI Lab',    icon:'🤖', color:'#c084fc' },
];
FL.registerTool = (t) => { FL.tools.push(t); };
FL.getTool = (id) => FL.tools.find(t=>t.id===id);
FL.toolsByCat = (cat) => FL.tools.filter(t=>t.category===cat);

/* ---------- Command Palette ---------- */
FL.palette = {
  open(){
    $('#cpBackdrop').classList.add('on');
    $('#cpInput').value=''; $('#cpInput').focus();
    this.filter('');
  },
  close(){ $('#cpBackdrop').classList.remove('on'); },
  toggle(){ $('#cpBackdrop').classList.contains('on') ? this.close() : this.open(); },
  sel: 0, results: [],
  filter(q){
    q = q.toLowerCase().trim();
    const favs = FL.favs.list();
    const recents = FL.recents.get();
    let items = [];
    // navigation actions
    const nav = [
      {name:'Home',desc:'Landing page',icon:'🏠',run:()=>FL.go('#/')},
      {name:'All Tools',desc:'Browse the tool catalog',icon:'🧰',run:()=>FL.go('#/tools')},
      {name:'CV Studio',desc:'Create & edit CVs',icon:'📄',run:()=>FL.go('#/cv')},
      {name:'Workspace',desc:'Your projects & favorites',icon:'📁',run:()=>FL.go('#/workspace')},
      {name:'AI Lab',desc:'AI text, translate, rewrite',icon:'🤖',run:()=>FL.go('#/ai')},
      {name:'Tool Builder',desc:'Build your own mini-tool',icon:'🔧',run:()=>FL.go('#/builder')},
      {name:'Privacy Center',desc:'Where data goes',icon:'🛡️',run:()=>FL.go('#/privacy')},
      {name:'❤️ Donate — Buy me a bowl of noodles',desc:'Support the admin via TPBank',icon:'🍜',run:()=>FL.go('#/donate')},
      {name:'Toggle theme',desc:'Dark ⇄ Light',icon:'🌓',run:()=>FL.theme.toggle()},
      {name:'Export backup',desc:'Download all workspace data',icon:'💾',run:()=>FL.workspace.exportAll()},
    ];
    if (!q){
      // recents + favs at top
      const recToolItems = recents.map(id=>FL.getTool(id)).filter(Boolean).map(t=>({...toItem(t), badge:'recent'}));
      const favItems = favs.map(id=>FL.getTool(id)).filter(Boolean).filter(t=>!recents.includes(t.id)).map(t=>({...toItem(t), badge:'★'}));
      items = [...recToolItems, ...favItems, ...nav];
    } else {
      const matches = FL.tools.filter(t => (t.name+' '+t.desc+' '+(t.tags||[]).join(' ')+' '+t.category).toLowerCase().includes(q));
      items = matches.map(toItem).concat(nav.filter(n=>n.name.toLowerCase().includes(q)));
    }
    function toItem(t){ return {name:t.name, desc:t.desc, icon:t.icon, cat:t.category, run:()=>FL.go('#/tools/'+t.id)}; }
    this.results = items.slice(0,40);
    this.sel = 0;
    this.paint();
  },
  paint(){
    const box = $('#cpResults');
    if (!this.results.length){ box.innerHTML = '<div class="cp-empty">No matches. Try another query.</div>'; return; }
    box.innerHTML = this.results.map((r,i)=>`
      <div class="cp-item${i===this.sel?' sel':''}" data-i="${i}">
        <div class="icon">${r.icon||'•'}</div>
        <div class="info">
          <div class="name">${esc(r.name)}${r.badge?' <span class="chip" style="margin-left:6px;font-size:10px">'+r.badge+'</span>':''}</div>
          <div class="desc">${esc(r.desc||'')}</div>
        </div>
        <div class="cat">${esc(r.cat||'')}</div>
      </div>`).join('');
    $$('.cp-item', box).forEach(n => n.addEventListener('click', ()=>{ this.sel=+n.dataset.i; this.enter(); }));
    const sel = box.querySelector('.cp-item.sel'); if (sel) sel.scrollIntoView({block:'nearest'});
  },
  enter(){
    const r = this.results[this.sel];
    if (!r) return;
    this.close();
    r.run();
  }
};

document.addEventListener('keydown', (e)=>{
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); FL.palette.toggle(); return; }
  if ($('#cpBackdrop').classList.contains('on')){
    if (e.key==='Escape'){ FL.palette.close(); }
    else if (e.key==='ArrowDown'){ e.preventDefault(); FL.palette.sel = Math.min(FL.palette.results.length-1, FL.palette.sel+1); FL.palette.paint(); }
    else if (e.key==='ArrowUp'){ e.preventDefault(); FL.palette.sel = Math.max(0, FL.palette.sel-1); FL.palette.paint(); }
    else if (e.key==='Enter'){ e.preventDefault(); FL.palette.enter(); }
  }
});
document.addEventListener('DOMContentLoaded', ()=>{
  $('#cpInput').addEventListener('input', e => FL.palette.filter(e.target.value));
});

/* ============================================================
   PAGES: Landing, Tools index, Category, Privacy, About
   ============================================================ */

FL.route('/', () => {
  const trending = ['json-formatter','pdf-merge','base64','uuid','password-gen','qr-gen','regex-tester','markdown-preview'];
  const popularTools = trending.map(id=>FL.getTool(id)).filter(Boolean);
  $('#view').innerHTML = `
    <section class="hero">
      <span class="eyebrow"><span class="dot"></span> ${FL.tools.length} tools · Privacy-first · Works offline</span>
      <h1>Everything you need.<br/>Right in your <span style="color:var(--accent)">browser</span>.</h1>
      <p class="tagline">FCMA bundles ${FL.tools.length}+ tools, a CV Studio, a Document Lab, an AI Lab and a Tool Builder — running locally on your device. No install. No tracking.</p>
      <div class="hero-search">
        <input id="heroSearch" placeholder="What do you want to do?  e.g., convert PDF to images"/>
        <div class="hero-search-hint">Press <kbd class="kbd">Ctrl K</kbd> anywhere to search tools</div>
      </div>
      <div class="hero-cta">
        <a class="btn btn-primary btn-lg" href="#/tools">Explore tools</a>
        <a class="btn btn-ghost btn-lg" href="#/cv">Create a CV</a>
        <a class="btn btn-ghost btn-lg" href="#/builder">Build your own tool</a>
      </div>
      <div class="cat-strip">
        ${FL.categories.filter(c=>FL.toolsByCat(c.id).length || c.id==='ai').map(c=>{
          const n = c.id==='ai' ? 9 : FL.toolsByCat(c.id).length;
          const href = c.id==='ai' ? '#/ai' : '#/tools/cat/'+c.id;
          return `<a class="cat-chip" href="${href}">${c.icon} ${esc(c.name)} <span class="count">${n}</span></a>`;
        }).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><h2>Popular tools</h2><p class="muted" style="margin-top:4px">Loved by developers, writers and job seekers.</p></div>
        <a href="#/tools" class="btn btn-ghost btn-sm">All ${FL.tools.length} tools →</a>
      </div>
      <div class="grid grid-4">
        ${popularTools.map(t => renderToolCard(t)).join('')}
      </div>
    </section>

    <section class="section" style="background:var(--bg-1);border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
      <div class="section-head" style="margin-bottom:24px"><div><h2>Why FCMA</h2><p class="muted" style="margin-top:4px">The 5 things that make us different.</p></div></div>
      <div class="wow-grid">
        <div class="wow"><div class="ic">🔧</div><h3>Build your own tool</h3><p>Describe what you need — FCMA generates a functional mini-tool that runs in a sandboxed iframe. Save, share, re-use.</p></div>
        <div class="wow"><div class="ic">📄</div><h3>CV Studio + AI</h3><p>Live preview, 3 templates, autosave to IndexedDB. AI helps rewrite bullets — but never invents metrics.</p></div>
        <div class="wow"><div class="ic">⛓️</div><h3>Tool chains</h3><p>Pipe files through multiple tools: CSV → dedupe → JSON → download. Save as a re-runnable workflow.</p></div>
        <div class="wow"><div class="ic">📁</div><h3>Local-first workspace</h3><p>Everything stored locally. Export a single backup file, restore anywhere. Your data, your device.</p></div>
        <div class="wow"><div class="ic">🎯</div><h3>Smart file inspector</h3><p>Drop a file — FCMA suggests what you can do with it: merge, convert, analyze, extract, sign, watermark…</p></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>Explore by category</h2></div></div>
      <div class="grid grid-4">
        ${FL.categories.map(c=>`
          <a class="tool-card" href="#/tools/cat/${c.id}">
            <div class="row"><div class="icon" style="background:${c.color}22;color:${c.color}">${c.icon}</div><h3>${esc(c.name)}</h3></div>
            <p>${FL.toolsByCat(c.id).length} tools</p>
          </a>`).join('')}
      </div>
    </section>

    <section class="section" style="border-top:1px solid var(--line)">
      <div class="container-sm" style="text-align:center;max-width:640px">
        <div style="font-size:32px;margin-bottom:8px">🍜</div>
        <h2>Nếu bạn thấy FCMA hữu ích…</h2>
        <p class="muted" style="margin-top:10px">Ủng hộ admin một gói mì (5.000đ) — hoặc một bát phở nếu bạn thấy tool tiết kiệm được nhiều thời gian. Không paywall, không quảng cáo, chỉ có tinh thần open-source.</p>
        <a class="btn btn-primary btn-lg" href="#/donate" style="margin-top:18px">❤️ Buy me a bowl of noodles</a>
      </div>
    </section>

    <footer class="footer">
      <div>FCMA v${FL.version} · <a href="#/privacy">Privacy Center</a> · <a href="#/about">About</a> · <a href="#/workspace">My Workspace</a> · <a href="#/donate" style="color:var(--accent)">❤️ Donate</a></div>
      <div style="margin-top:6px">Built browser-side. Your data stays on your device.</div>
    </footer>`;
  $('#heroSearch').addEventListener('input', debounce(e=>{
    if (e.target.value.trim()){ FL.palette.open(); $('#cpInput').value = e.target.value; FL.palette.filter(e.target.value); e.target.value=''; }
  }, 200));
});

function renderToolCard(t){
  const priv = t.privacy || 'local';
  const privLabel = {local:'Local',remote:'Remote',ai:'AI'}[priv];
  const fav = FL.favs.has(t.id);
  return `<a class="tool-card" href="#/tools/${t.id}" data-tool="${t.id}">
    <div class="row">
      <div class="icon">${t.icon||'•'}</div>
      <h3>${esc(t.name)}</h3>
      <button class="fav-btn ${fav?'on':''}" onclick="event.preventDefault();event.stopPropagation();FL.favs.toggle('${t.id}');FL.render()">${fav?'★':'☆'}</button>
    </div>
    <p>${esc(t.desc)}</p>
    <div class="foot"><span class="privacy-badge privacy-${priv}">${priv==='local'?'🟢':priv==='remote'?'🟡':'🔵'} ${privLabel}</span>
    <span class="chip">${esc(t.category)}</span></div>
  </a>`;
}

FL.route('/tools', () => {
  const q = new URLSearchParams(location.hash.split('?')[1]||'').get('q')||'';
  $('#view').innerHTML = `
    <div class="container">
      <div class="section-head" style="margin-bottom:20px">
        <div><h2>All tools</h2><p class="muted" style="margin-top:4px">${FL.tools.length} tools across ${FL.categories.length} categories</p></div>
        <input id="toolFilter" placeholder="Filter…" style="max-width:280px" value="${esc(q)}"/>
      </div>
      <div id="toolResults"></div>
    </div>`;
  const paint = (query='') => {
    const box = $('#toolResults');
    if (!query){
      // group by category
      box.innerHTML = FL.categories.map(c=>{
        const list = FL.toolsByCat(c.id);
        if (!list.length) return '';
        return `<div style="margin-bottom:36px">
          <h3 style="margin-bottom:14px;display:flex;align-items:center;gap:8px"><span style="color:${c.color}">${c.icon}</span> ${esc(c.name)} <span class="chip">${list.length}</span></h3>
          <div class="grid grid-4">${list.map(renderToolCard).join('')}</div>
        </div>`;
      }).join('');
    } else {
      const q = query.toLowerCase();
      const matches = FL.tools.filter(t => (t.name+' '+t.desc+' '+(t.tags||[]).join(' ')).toLowerCase().includes(q));
      box.innerHTML = matches.length ? `<div class="grid grid-4">${matches.map(renderToolCard).join('')}</div>` : `<div class="empty"><div class="em">🔍</div>No tools match "${esc(query)}"</div>`;
    }
  };
  paint(q);
  $('#toolFilter').addEventListener('input', debounce(e=>paint(e.target.value), 150));
});

FL.route('/tools/cat/:cat', ({cat}) => {
  const c = FL.categories.find(x=>x.id===cat);
  if (!c) return FL.notFound();
  const list = FL.toolsByCat(cat);
  $('#view').innerHTML = `
    <div class="container">
      <a href="#/tools" class="muted" style="font-size:13px">← All categories</a>
      <div class="section-head" style="margin:12px 0 20px">
        <div><h2 style="display:flex;align-items:center;gap:10px"><span style="color:${c.color}">${c.icon}</span> ${esc(c.name)}</h2><p class="muted" style="margin-top:4px">${list.length} tools</p></div>
      </div>
      <div class="grid grid-4">${list.map(renderToolCard).join('')}</div>
    </div>`;
});

FL.route('/tools/:id', ({id}) => {
  const t = FL.getTool(id);
  if (!t) return FL.notFound();
  FL.recents.add(id);
  const view = $('#view');
  view.innerHTML = `<div class="tool-page">
    <aside class="tool-sidebar" id="toolSide"></aside>
    <div class="tool-content" id="toolContent"></div>
  </div>`;
  // sidebar: other tools in same category + recent
  const side = $('#toolSide');
  const catTools = FL.toolsByCat(t.category);
  side.innerHTML = `
    <h4>${FL.categories.find(c=>c.id===t.category)?.name || t.category}</h4>
    ${catTools.map(x=>`<a class="side-link ${x.id===id?'active':''}" href="#/tools/${x.id}"><span class="ic">${x.icon||'•'}</span> ${esc(x.name)}</a>`).join('')}
    <h4>Recent</h4>
    ${FL.recents.get().slice(0,6).map(rid=>{const rt=FL.getTool(rid); return rt?`<a class="side-link" href="#/tools/${rt.id}"><span class="ic">${rt.icon||'•'}</span> ${esc(rt.name)}</a>`:''}).join('')}
  `;
  // content: header + tool
  const content = $('#toolContent');
  const fav = FL.favs.has(id);
  content.innerHTML = `<div class="tool-header">
    <div>
      <h1 style="display:flex;align-items:center;gap:10px"><span>${t.icon||''}</span> ${esc(t.name)}</h1>
      <p>${esc(t.desc)}</p>
    </div>
    <div class="tool-actions">
      <button class="btn btn-ghost btn-sm" onclick="FL.favs.toggle('${id}');FL.render()">${fav?'★ Favorited':'☆ Favorite'}</button>
      <span class="privacy-badge privacy-${t.privacy||'local'}">${(t.privacy||'local')==='local'?'🟢 Local':(t.privacy||'local')==='remote'?'🟡 Remote':'🔵 AI'}</span>
    </div>
  </div><div id="toolMount"></div>`;
  const mount = $('#toolMount');
  Promise.resolve(t.mount(mount)).catch(err => {
    mount.innerHTML = `<div class="note err">Tool failed to load: ${esc(err.message)}</div>`;
    console.error(err);
  });
});

/* Privacy Center */
FL.route('/privacy', ()=>{
  const groups = {local:[],remote:[],ai:[]};
  for (const t of FL.tools){ groups[t.privacy||'local'].push(t); }
  $('#view').innerHTML = `
    <div class="container-sm">
      <h1>Privacy Center</h1>
      <p class="muted" style="margin-top:8px">FCMA is built to keep your data on your device. Here's exactly where each tool sends data.</p>
      <div class="card" style="margin-top:24px">
        <h3><span class="privacy-badge privacy-local">🟢 Local</span> · ${groups.local.length} tools</h3>
        <p class="muted" style="margin:6px 0 12px;font-size:13.5px">Data never leaves your browser. Processing happens on your device.</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${groups.local.map(t=>`<a class="chip" href="#/tools/${t.id}">${esc(t.name)}</a>`).join('')}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3><span class="privacy-badge privacy-remote">🟡 Remote</span> · ${groups.remote.length} tools</h3>
        <p class="muted" style="margin:6px 0 12px;font-size:13.5px">Data is sent to a required 3rd-party service (e.g., public DNS). Each tool shows a clear notice.</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${groups.remote.map(t=>`<a class="chip" href="#/tools/${t.id}">${esc(t.name)}</a>`).join('')}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3><span class="privacy-badge privacy-ai">🔵 AI</span> · ${groups.ai.length} tools</h3>
        <p class="muted" style="margin:6px 0 12px;font-size:13.5px">Text you enter is sent to an AI provider (Puter.js by default, or your OpenAI key if configured). Don't paste secrets.</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${groups.ai.map(t=>`<a class="chip" href="#/tools/${t.id}">${esc(t.name)}</a>`).join('')}</div>
      </div>
      <h2 style="margin-top:32px">Storage</h2>
      <ul style="color:var(--text-2);line-height:1.9">
        <li><b>IndexedDB</b> — CVs, projects, built tools, chains. Managed by <code>Dexie</code>. Cleared when you clear browser data.</li>
        <li><b>localStorage</b> — favorites, recents, theme, small settings.</li>
        <li>No account server. No analytics. No cookies.</li>
      </ul>
      <p style="margin-top:20px"><button class="btn btn-primary" onclick="FL.workspace.exportAll()">💾 Export backup</button> <button class="btn btn-ghost" onclick="document.getElementById('importIn').click()">📂 Import backup</button><input id="importIn" type="file" accept=".json" style="display:none" onchange="FL.workspace.importAll(event.target.files[0])"/></p>
    </div>`;
});

FL.route('/about', ()=>{
  $('#view').innerHTML = `<div class="container-sm">
    <h1>About FCMA</h1>
    <p class="muted" style="margin-top:8px">Version ${FL.version} · <span class="chip">MVP</span></p>
    <p style="margin-top:20px;line-height:1.7">FCMA is a browser-first toolbox: developer utilities, PDF & document tools, a CV Studio with live preview, an AI Lab, a Tool Builder, and a local-first workspace — all in one page, all working offline for local tools.</p>
    <h3 style="margin-top:24px">Open-source libraries used</h3>
    <ul style="color:var(--text-2);line-height:1.9">
      <li><a href="https://dexie.org" target="_blank">Dexie</a> — IndexedDB wrapper (Apache-2.0)</li>
      <li><a href="https://pdf-lib.js.org" target="_blank">pdf-lib</a> — PDF manipulation (MIT)</li>
      <li><a href="https://sheetjs.com" target="_blank">SheetJS Community</a> — XLSX/CSV parsing (Apache-2.0)</li>
      <li><a href="https://js.puter.com" target="_blank">Puter.js</a> — free-tier AI (MIT)</li>
      <li><a href="https://github.com/soldair/node-qrcode" target="_blank">qrcode</a> — QR code generation (MIT)</li>
    </ul>
    <h3 style="margin-top:24px">Roadmap</h3>
    <p style="color:var(--text-2)">See <a href="#/privacy">Privacy Center</a> for storage & data flow. Full roadmap in the source repo.</p>
    <p style="margin-top:20px"><a class="btn btn-primary" href="#/">← Back home</a></p>
  </div>`;
});

/* ============================================================
   Donate page — support the admin
   ============================================================ */

FL.route('/donate', ()=>{
  $('#view').innerHTML = `<div class="container-sm" style="max-width:720px">
    <div style="text-align:center">
      <h1 style="font-size:38px">❤️ Buy the admin a bowl of noodles</h1>
      <p class="muted" style="margin-top:10px;font-size:15px">FCMA hoàn toàn miễn phí và luôn miễn phí. Nếu bạn thấy nó hữu ích, một gói mì cho admin sẽ tiếp thêm động lực xây thêm tool 🍜</p>
    </div>

    <div class="card" style="margin-top:32px;text-align:center;background:linear-gradient(180deg,var(--bg-1),var(--bg-2));border-color:var(--accent);position:relative;overflow:hidden">
      <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:radial-gradient(circle,var(--accent-glow),transparent 70%);pointer-events:none"></div>

      <div style="display:inline-block;background:#fff;padding:14px;border-radius:14px;margin-bottom:18px">
        <img src="donate-qr.png" alt="TPBank QR code" style="max-width:260px;height:auto;display:block"/>
      </div>

      <div style="display:inline-flex;align-items:center;gap:10px;background:var(--bg-2);border:1px solid var(--line);padding:6px 14px;border-radius:99px;font-size:13px;color:var(--muted-2)">
        <span style="width:22px;height:22px;border-radius:5px;background:#7b2ff2;display:grid;place-items:center;color:#fff;font-weight:800;font-size:11px">TP</span>
        TPBank · Ngân hàng Tiên Phong
      </div>

      <div style="margin-top:22px;display:grid;gap:14px;text-align:left;max-width:420px;margin-left:auto;margin-right:auto">
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:600">Chủ tài khoản</div>
          <div style="font-size:17px;font-weight:600;margin-top:3px">TRAN MINH A</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:600">Số tài khoản</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:3px">
            <div class="mono" style="font-size:22px;font-weight:700;color:var(--accent);letter-spacing:.02em">66681793939</div>
            <button class="btn btn-ghost btn-sm" onclick="FL.util.copy('66681793939')">📋 Copy</button>
          </div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:600">Nội dung gợi ý</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:3px">
            <code style="font-size:14px;padding:4px 10px;background:var(--bg-3);border-radius:5px">MI GOI FCMA</code>
            <button class="btn btn-ghost btn-sm" onclick="FL.util.copy('MI GOI FCMA')">📋 Copy</button>
          </div>
        </div>
      </div>

      <div style="margin-top:26px;padding-top:20px;border-top:1px dashed var(--line);font-size:13px;color:var(--muted)">
        Mở app ngân hàng bất kỳ → <b>Quét QR</b> → nhập số tiền.<br/>
        Một gói mì Hảo Hảo ~5.000đ · Một bát phở ~50.000đ · Một tuần cà phê ~200.000đ ☕
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:24px">
      <div class="card">
        <h3>Cách khác để ủng hộ</h3>
        <ul style="color:var(--text-2);line-height:2;margin-top:8px;font-size:14px">
          <li>⭐ Star repo trên GitHub</li>
          <li>🐛 Report bug hoặc gợi ý tool mới</li>
          <li>🔧 Đóng góp tool qua Pull Request</li>
          <li>📢 Chia sẻ FCMA cho bạn bè</li>
        </ul>
      </div>
      <div class="card">
        <h3>FCMA cam kết</h3>
        <ul style="color:var(--text-2);line-height:2;margin-top:8px;font-size:14px">
          <li>✅ Miễn phí toàn bộ tool local mãi mãi</li>
          <li>✅ Không quảng cáo, không tracking</li>
          <li>✅ Không paywall các tính năng cơ bản</li>
          <li>✅ Mã nguồn mở, minh bạch</li>
        </ul>
      </div>
    </div>

    <p style="text-align:center;margin-top:32px;color:var(--muted);font-size:14px">Cảm ơn bạn đã ủng hộ 🙏</p>
  </div>`;
});

/* ============================================================
   Workspace: favorites, recents, projects, backup, built tools
   ============================================================ */

FL.workspace = {
  async exportAll(){
    const payload = { version:1, exportedAt:Date.now(), settings:{ theme: FL.theme.get(), favs: FL.favs.list(), recents: FL.recents.get() } };
    if (FL.db){
      payload.cvs = await FL.db.cvs.toArray();
      payload.projects = await FL.db.projects.toArray();
      payload.builtTools = await FL.db.builtTools.toArray();
      payload.tool_chains = await FL.db.tool_chains.toArray();
    }
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    download(blob, `FCMA-backup-${new Date().toISOString().slice(0,10)}.json`);
    FL.toast('Backup exported','ok');
  },
  async importAll(file){
    if (!file) return;
    try{
      const txt = await readFile(file,'text');
      const data = JSON.parse(txt);
      if (!data.version) throw new Error('Not a FCMA backup file');
      if (data.settings){
        if (data.settings.theme) FL.theme.set(data.settings.theme);
        if (data.settings.favs){ localStorage.setItem('fl-favs', JSON.stringify(data.settings.favs)); FL.favs.cache = new Set(data.settings.favs); }
        if (data.settings.recents) localStorage.setItem('fl-recents', JSON.stringify(data.settings.recents));
      }
      if (FL.db){
        if (data.cvs?.length) await FL.db.cvs.bulkPut(data.cvs);
        if (data.projects?.length) await FL.db.projects.bulkPut(data.projects);
        if (data.builtTools?.length) await FL.db.builtTools.bulkPut(data.builtTools);
        if (data.tool_chains?.length) await FL.db.tool_chains.bulkPut(data.tool_chains);
      }
      FL.toast('Backup imported','ok');
      FL.render();
    }catch(e){ FL.toast('Import failed: '+e.message,'err'); }
  }
};

FL.route('/workspace', async ()=>{
  const view = $('#view');
  view.innerHTML = `<div class="container">
    <div class="section-head" style="margin-bottom:16px">
      <div><h2>My Workspace</h2><p class="muted" style="margin-top:4px">Everything stored locally on this device.</p></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="FL.workspace.exportAll()">💾 Export backup</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('wsImport').click()">📂 Import</button>
        <input id="wsImport" type="file" accept=".json" style="display:none" onchange="FL.workspace.importAll(event.target.files[0])"/>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h3>⭐ Favorites</h3>
        <div id="wsFavs" style="margin-top:10px;display:grid;gap:6px"></div>
      </div>
      <div class="card">
        <h3>🕒 Recently used</h3>
        <div id="wsRecents" style="margin-top:10px;display:grid;gap:6px"></div>
      </div>
      <div class="card">
        <h3>📄 My CVs</h3>
        <div id="wsCvs" style="margin-top:10px;display:grid;gap:6px"></div>
        <p style="margin-top:12px"><a class="btn btn-primary btn-sm" href="#/cv">Open CV Studio →</a></p>
      </div>
      <div class="card">
        <h3>🔧 My built tools</h3>
        <div id="wsBuilt" style="margin-top:10px;display:grid;gap:6px"></div>
        <p style="margin-top:12px"><a class="btn btn-primary btn-sm" href="#/builder">Open Tool Builder →</a></p>
      </div>
    </div>
  </div>`;
  const paintList = (root, ids) => {
    root.innerHTML = ids.length ? ids.map(id=>{const t=FL.getTool(id); return t?`<a class="side-link" href="#/tools/${t.id}"><span class="ic">${t.icon||'•'}</span>${esc(t.name)}<span class="chip" style="margin-left:auto">${esc(t.category)}</span></a>`:''}).filter(Boolean).join('') : `<div class="empty" style="padding:20px"><div class="em">—</div>Nothing yet</div>`;
  };
  paintList($('#wsFavs'), FL.favs.list());
  paintList($('#wsRecents'), FL.recents.get());
  if (FL.db){
    const cvs = await FL.db.cvs.orderBy('updatedAt').reverse().toArray();
    $('#wsCvs').innerHTML = cvs.length ? cvs.slice(0,6).map(c=>`<a class="side-link" href="#/cv?id=${c.id}"><span class="ic">📄</span>${esc(c.name)}<span class="chip" style="margin-left:auto">${fmtDate(c.updatedAt)}</span></a>`).join('') : `<div class="empty" style="padding:20px"><div class="em">📄</div>No CVs yet</div>`;
    const bt = await FL.db.builtTools.orderBy('updatedAt').reverse().toArray();
    $('#wsBuilt').innerHTML = bt.length ? bt.slice(0,6).map(b=>`<a class="side-link" href="#/builder?id=${b.id}"><span class="ic">🔧</span>${esc(b.name)}<span class="chip" style="margin-left:auto">${fmtDate(b.updatedAt)}</span></a>`).join('') : `<div class="empty" style="padding:20px"><div class="em">🔧</div>Nothing built yet</div>`;
  } else {
    $('#wsCvs').innerHTML = '<div class="note warn">Storage not ready. Refresh the page.</div>';
    $('#wsBuilt').innerHTML = '';
  }
});


/* ============================================================
   CV STUDIO — live editor + templates + IndexedDB + AI assist
   ============================================================ */

const CV_DEFAULT = () => ({
  id: uid(),
  name: 'Untitled CV',
  template: 'classic',
  accent: '#ff6a2b',
  data: {
    name: 'Your Name',
    title: 'Your Job Title',
    email: 'you@example.com',
    phone: '+84 000 000 000',
    location: 'City, Country',
    website: '', linkedin: '', github: '',
    summary: 'One-paragraph summary of who you are, what you build and what you\'re looking for.',
    experience: [
      { role:'Senior Engineer', company:'Acme Inc.', period:'2023 — Present', location:'Remote', desc:'• Led migration to X, cutting Y by [add metric].\n• Built and shipped [feature].' },
      { role:'Software Engineer', company:'Beta Co.', period:'2021 — 2023', location:'Hanoi', desc:'• Owned [system].\n• Mentored [n] engineers.' },
    ],
    education: [
      { school:'University Name', degree:'B.Sc. Computer Science', period:'2017 — 2021', desc:'GPA: —' }
    ],
    skills: ['JavaScript','TypeScript','Python','SQL','React','Node.js'],
    projects: [
      { name:'Project Name', link:'', desc:'What it does and what you built.' }
    ],
    certifications: [],
    languages: ['English (fluent)','Vietnamese (native)'],
  },
  createdAt: Date.now(),
  updatedAt: Date.now()
});

FL.cv = {
  current: null,
  saveDebounced: null,
  async list(){ if (!FL.db) return []; return FL.db.cvs.orderBy('updatedAt').reverse().toArray(); },
  async load(id){ if (!FL.db) return null; return FL.db.cvs.get(id); },
  async save(cv){ if (!FL.db) return; cv.updatedAt = Date.now(); await FL.db.cvs.put(cv); },
  async delete(id){ if (!FL.db) return; await FL.db.cvs.delete(id); },
  render(cv){
    const d = cv.data;
    const contact = [d.email && `✉ ${d.email}`, d.phone && `☎ ${d.phone}`, d.location && `📍 ${d.location}`, d.website && `🔗 ${d.website}`, d.linkedin && `in/${d.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//,'')}`, d.github && `gh/${d.github.replace(/^https?:\/\/(www\.)?github\.com\//,'')}`].filter(Boolean).join('  ·  ');
    const section = (title, body) => body ? `<h2>${esc(title)}</h2>${body}` : '';
    const expBlock = d.experience?.length ? d.experience.map(e=>`<div class="entry"><div class="h"><span>${esc(e.role)} — ${esc(e.company)}</span><span>${esc(e.period||'')}</span></div><div class="sub">${esc(e.location||'')}</div><div class="desc">${esc(e.desc||'')}</div></div>`).join('') : '';
    const eduBlock = d.education?.length ? d.education.map(e=>`<div class="entry"><div class="h"><span>${esc(e.degree)} — ${esc(e.school)}</span><span>${esc(e.period||'')}</span></div><div class="desc">${esc(e.desc||'')}</div></div>`).join('') : '';
    const projBlock = d.projects?.length ? d.projects.map(p=>`<div class="entry"><div class="h"><span>${esc(p.name)}${p.link?` — <span class="sub">${esc(p.link)}</span>`:''}</span></div><div class="desc">${esc(p.desc||'')}</div></div>`).join('') : '';
    const skillsBlock = d.skills?.length ? `<div class="skills">${d.skills.map(s=>`<span>${esc(s)}</span>`).join('')}</div>` : '';
    const certBlock = d.certifications?.length ? `<div>${d.certifications.map(c=>`<div class="entry"><div class="h">${esc(c.name)}</div><div class="sub">${esc(c.issuer||'')} ${esc(c.date||'')}</div></div>`).join('')}</div>` : '';
    const langBlock = d.languages?.length ? `<div>${d.languages.map(l=>`<span class="skills"><span>${esc(l)}</span></span>`).join(' ')}</div>` : '';

    if (cv.template === 'modern'){
      return `<div class="cv-paper cv-modern" style="--cv:${cv.accent}">
        <div class="left">
          <h1>${esc(d.name)}</h1>
          <div class="job-title">${esc(d.title)}</div>
          <h2>Contact</h2><div class="contact">
            ${d.email?`<span>${esc(d.email)}</span>`:''}
            ${d.phone?`<span>${esc(d.phone)}</span>`:''}
            ${d.location?`<span>${esc(d.location)}</span>`:''}
            ${d.website?`<span>${esc(d.website)}</span>`:''}
            ${d.linkedin?`<span>${esc(d.linkedin)}</span>`:''}
            ${d.github?`<span>${esc(d.github)}</span>`:''}
          </div>
          ${d.skills?.length?`<h2>Skills</h2><div class="skills">${d.skills.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}
          ${d.languages?.length?`<h2>Languages</h2><div class="skills">${d.languages.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}
        </div>
        <div class="right">
          ${d.summary?`<h2>Summary</h2><p style="font-size:13px;color:#222">${esc(d.summary)}</p>`:''}
          ${expBlock?`<h2>Experience</h2>${expBlock}`:''}
          ${eduBlock?`<h2>Education</h2>${eduBlock}`:''}
          ${projBlock?`<h2>Projects</h2>${projBlock}`:''}
          ${certBlock?`<h2>Certifications</h2>${certBlock}`:''}
        </div>
      </div>`;
    }
    if (cv.template === 'minimal'){
      return `<div class="cv-paper cv-minimal">
        <h1>${esc(d.name)}</h1><div class="job-title">${esc(d.title)}</div>
        <div class="contact">${contact}</div>
        ${d.summary?`<h2>Summary</h2><p style="font-size:13px;color:#333">${esc(d.summary)}</p>`:''}
        ${expBlock?`<h2>Experience</h2>${expBlock}`:''}
        ${eduBlock?`<h2>Education</h2>${eduBlock}`:''}
        ${projBlock?`<h2>Projects</h2>${projBlock}`:''}
        ${d.skills?.length?`<h2>Skills</h2><div class="skills">${d.skills.join(' · ')}</div>`:''}
        ${d.languages?.length?`<h2>Languages</h2><div class="skills">${d.languages.join(' · ')}</div>`:''}
        ${certBlock?`<h2>Certifications</h2>${certBlock}`:''}
      </div>`;
    }
    // classic
    return `<div class="cv-paper cv-classic" style="border-top:5px solid ${cv.accent}">
      <h1>${esc(d.name)}</h1>
      <div class="job-title">${esc(d.title)}</div>
      <div class="contact">${contact}</div>
      ${d.summary?`<h2>Summary</h2><p>${esc(d.summary)}</p>`:''}
      ${expBlock?`<h2>Experience</h2>${expBlock}`:''}
      ${eduBlock?`<h2>Education</h2>${eduBlock}`:''}
      ${projBlock?`<h2>Projects</h2>${projBlock}`:''}
      ${d.skills?.length?`<h2>Skills</h2>${skillsBlock}`:''}
      ${d.languages?.length?`<h2>Languages</h2>${d.languages.join(' · ')}`:''}
      ${certBlock?`<h2>Certifications</h2>${certBlock}`:''}
    </div>`;
  }
};

FL.route('/cv', async ()=>{
  // Render skeleton immediately
  $('#view').innerHTML = `<div style="padding:60px;text-align:center;color:var(--muted)"><div class="spin" style="width:24px;height:24px;border-width:3px"></div><div style="margin-top:12px">Loading CV Studio…</div></div>`;
  await FL.initDBIfNeeded();
  const params = new URLSearchParams(location.hash.split('?')[1]||'');
  let id = params.get('id');
  let list = await FL.cv.list();
  if (!id){
    if (list.length){ id = list[0].id; }
    else { const nu = CV_DEFAULT(); await FL.cv.save(nu); list = await FL.cv.list(); id = nu.id; }
  }
  let cv = await FL.cv.load(id);
  if (!cv){ const nu = CV_DEFAULT(); await FL.cv.save(nu); list = await FL.cv.list(); cv = nu; }
  FL.cv.current = cv;
  renderCVUI(cv, list);
});

function renderCVUI(cv, list){
  const view = $('#view');
  view.innerHTML = `<div class="cv-editor">
    <div class="cv-panel">
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="cvNew">+ New</button>
        <button class="btn btn-ghost btn-sm" id="cvRename">Rename</button>
        <button class="btn btn-ghost btn-sm" id="cvDup">Duplicate</button>
        <button class="btn btn-ghost btn-sm" id="cvExport">↓ HTML</button>
        <button class="btn btn-ghost btn-sm" id="cvPrint">🖨 PDF</button>
        <button class="btn btn-danger btn-sm" id="cvDel">Delete</button>
      </div>
      <div class="cv-list-file" id="cvList"></div>

      <h4 style="margin:8px 0">Template</h4>
      <div style="display:flex;gap:6px;margin-bottom:10px">
        ${['classic','modern','minimal'].map(t=>`<button class="btn btn-sm ${cv.template===t?'btn-primary':'btn-ghost'}" data-tpl="${t}">${t}</button>`).join('')}
      </div>
      <h4 style="margin:12px 0 4px">Accent color</h4>
      <div class="cv-color-picker" id="cvColor">
        ${['#ff6a2b','#0b0d10','#2563eb','#059669','#7c3aed','#e11d48','#f59e0b','#64748b'].map(c=>`<div class="cv-color-swatch ${cv.accent===c?'on':''}" style="background:${c}" data-c="${c}"></div>`).join('')}
      </div>

      <div id="cvForm" style="margin-top:16px"></div>

      <div style="position:sticky;bottom:0;background:var(--bg-1);padding-top:10px;margin-top:12px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)" id="cvStatus">
        Saved · <span id="cvSaved">${fmtDate(cv.updatedAt)}</span>
      </div>
    </div>
    <div class="cv-preview"><div id="cvPreview">${FL.cv.render(cv)}</div></div>
  </div>`;

  const renderList = async () => {
    const listCur = await FL.cv.list();
    $('#cvList').innerHTML = listCur.map(c=>`<div class="cv-file-item ${c.id===cv.id?'active':''}" data-id="${c.id}"><span>📄</span><span class="n">${esc(c.name)}</span><span class="m">${fmtDate(c.updatedAt)}</span></div>`).join('');
    $$('#cvList .cv-file-item').forEach(n => n.addEventListener('click', ()=> FL.go('#/cv?id='+n.dataset.id)));
  };
  renderList();

  const renderForm = () => {
    const d = cv.data;
    const inp = (key, label, type='input') => `<div class="field" style="margin-bottom:8px"><label>${label}</label>${type==='textarea'?`<textarea data-key="${key}" rows="3">${esc(d[key]||'')}</textarea>`:`<input type="text" data-key="${key}" value="${esc(d[key]||'')}"/>`}</div>`;
    const arraySection = (key, title, fields, addLabel) => {
      const items = d[key]||[];
      return `<div class="cv-section"><div class="cv-section-head"><h4>${title}</h4><button class="btn btn-ghost btn-sm" data-add="${key}">+ Add</button></div>
        <div class="cv-section-body">
          ${items.map((it,i)=>`<div class="cv-item" data-arr="${key}" data-i="${i}">
            <button class="del" data-del="${key}" data-i="${i}">✕</button>
            ${fields.map(([k,l,t])=>`<div class="field" style="margin-bottom:6px"><label>${l}</label>${t==='textarea'?`<textarea data-arr-key="${k}" rows="3">${esc(it[k]||'')}</textarea>`:`<input type="text" data-arr-key="${k}" value="${esc(it[k]||'')}"/>`}</div>`).join('')}
          </div>`).join('')}
        </div></div>`;
    };
    const skillsSection = `<div class="cv-section"><div class="cv-section-head"><h4>Skills (comma separated)</h4></div>
      <input type="text" id="cvSkills" value="${esc((d.skills||[]).join(', '))}"/></div>`;
    const langSection = `<div class="cv-section"><div class="cv-section-head"><h4>Languages (comma separated)</h4></div>
      <input type="text" id="cvLangs" value="${esc((d.languages||[]).join(', '))}"/></div>`;

    $('#cvForm').innerHTML = `
      <div class="cv-section"><h4 style="margin-bottom:8px">Personal</h4>
        ${inp('name','Name')}${inp('title','Job Title')}${inp('email','Email')}${inp('phone','Phone')}${inp('location','Location')}${inp('website','Website')}${inp('linkedin','LinkedIn')}${inp('github','GitHub')}
      </div>
      <div class="cv-section"><h4 style="margin-bottom:8px">Summary
        <button class="btn btn-ghost btn-sm" style="float:right" onclick="FL.cv.aiRewrite('summary')">✨ AI</button>
      </h4>${inp('summary','','textarea')}</div>
      ${arraySection('experience','Experience',[['role','Role'],['company','Company'],['period','Period'],['location','Location'],['desc','Description (bullets)','textarea']])}
      ${arraySection('education','Education',[['degree','Degree'],['school','School'],['period','Period'],['desc','Notes','textarea']])}
      ${arraySection('projects','Projects',[['name','Name'],['link','Link'],['desc','Description','textarea']])}
      ${skillsSection}
      ${langSection}
      ${arraySection('certifications','Certifications',[['name','Name'],['issuer','Issuer'],['date','Date']])}
    `;

    const repaint = debounce(async ()=>{
      await FL.cv.save(cv);
      $('#cvPreview').innerHTML = FL.cv.render(cv);
      $('#cvSaved').textContent = 'just now';
      renderList();
    }, 250);

    $$('#cvForm [data-key]').forEach(n => n.addEventListener('input', e => { d[e.target.dataset.key] = e.target.value; repaint(); }));
    $$('#cvForm .cv-item').forEach(item => {
      const key = item.dataset.arr; const i = +item.dataset.i;
      $$('[data-arr-key]', item).forEach(inp => inp.addEventListener('input', e => { d[key][i][e.target.dataset.arrKey] = e.target.value; repaint(); }));
    });
    $$('#cvForm [data-add]').forEach(b => b.addEventListener('click', ()=>{
      const key = b.dataset.add;
      const blanks = { experience:{role:'',company:'',period:'',location:'',desc:''}, education:{degree:'',school:'',period:'',desc:''}, projects:{name:'',link:'',desc:''}, certifications:{name:'',issuer:'',date:''} };
      d[key] = d[key]||[]; d[key].push(blanks[key]); renderForm(); repaint();
    }));
    $$('#cvForm [data-del]').forEach(b => b.addEventListener('click', ()=>{
      const key = b.dataset.del; const i = +b.dataset.i;
      d[key].splice(i,1); renderForm(); repaint();
    }));
    $('#cvSkills').addEventListener('input', e => { d.skills = e.target.value.split(',').map(s=>s.trim()).filter(Boolean); repaint(); });
    $('#cvLangs').addEventListener('input', e => { d.languages = e.target.value.split(',').map(s=>s.trim()).filter(Boolean); repaint(); });
  };
  renderForm();

  // template & color
  $$('#view [data-tpl]').forEach(b => b.addEventListener('click', ()=>{ cv.template = b.dataset.tpl; renderCVUI(cv, list); FL.cv.save(cv); }));
  $$('#cvColor [data-c]').forEach(b => b.addEventListener('click', ()=>{ cv.accent = b.dataset.c; $$('#cvColor .cv-color-swatch').forEach(s=>s.classList.remove('on')); b.classList.add('on'); $('#cvPreview').innerHTML=FL.cv.render(cv); FL.cv.save(cv); }));

  $('#cvNew').addEventListener('click', async ()=>{ const nu = CV_DEFAULT(); await FL.cv.save(nu); FL.go('#/cv?id='+nu.id); });
  $('#cvRename').addEventListener('click', async ()=>{ const n = prompt('Rename CV', cv.name); if(n){ cv.name = n; await FL.cv.save(cv); FL.render(); } });
  $('#cvDup').addEventListener('click', async ()=>{ const nu = JSON.parse(JSON.stringify(cv)); nu.id = uid(); nu.name = cv.name+' (copy)'; nu.createdAt=Date.now(); await FL.cv.save(nu); FL.go('#/cv?id='+nu.id); });
  $('#cvDel').addEventListener('click', async ()=>{ if(!confirm('Delete this CV?')) return; await FL.cv.delete(cv.id); FL.go('#/cv'); });
  $('#cvExport').addEventListener('click', ()=>{
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(cv.data.name)}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><style>body{font-family:Inter,sans-serif;background:#eee;padding:24px;margin:0}${document.querySelector('style').textContent}</style></head><body>${FL.cv.render(cv)}</body></html>`;
    download(new Blob([html],{type:'text/html'}), (cv.name||'cv')+'.html');
  });
  $('#cvPrint').addEventListener('click', ()=>{
    const w = window.open('','_blank');
    w.document.write(`<!doctype html><html><head><title>${esc(cv.data.name)}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><style>body{font-family:Inter,sans-serif;background:#fff;padding:0;margin:0}@page{margin:12mm}${document.querySelector('style').textContent}</style></head><body onload="window.print()">${FL.cv.render(cv)}</body></html>`);
    w.document.close();
  });
}

FL.cv.aiRewrite = async (key) => {
  const cv = FL.cv.current; if (!cv) return;
  const cur = cv.data[key]; if (!cur){ FL.toast('Nothing to rewrite','warn'); return; }
  FL.toast('AI rewriting…');
  try {
    const out = await FL.ai.chat(`Rewrite the following CV ${key} to be more concise, professional and ATS-friendly. Keep it in the same language. Do NOT invent metrics or numbers that aren't already present. Return only the rewritten text, no preface.\n\n---\n${cur}`);
    cv.data[key] = out.trim();
    await FL.cv.save(cv);
    FL.render();
    FL.toast('Rewrote with AI','ok');
  } catch(e){ FL.toast('AI failed: '+e.message,'err'); }
};

FL.initDBIfNeeded = async () => { if (!FL.db) await FL.initDB(); };


/* ============================================================
   AI backend abstraction: Puter.js (free) or user's OpenAI key
   ============================================================ */

FL.ai = {
  provider: localStorage.getItem('fl-ai-provider') || 'puter',
  key: localStorage.getItem('fl-ai-key') || '',
  setProvider(p){ this.provider = p; localStorage.setItem('fl-ai-provider', p); },
  setKey(k){ this.key = k; localStorage.setItem('fl-ai-key', k); },
  async loadPuter(){
    if (window.puter) return;
    return new Promise((res,rej)=>{
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload = () => setTimeout(res, 200);
      s.onerror = () => rej(new Error('Failed to load Puter.js'));
      document.head.appendChild(s);
    });
  },
  async chat(prompt, system=''){
    if (this.provider === 'openai'){
      if (!this.key) throw new Error('Set your OpenAI API key first (AI Lab → Settings)');
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+this.key},
        body: JSON.stringify({model:'gpt-4o-mini', messages:[system?{role:'system',content:system}:null,{role:'user',content:prompt}].filter(Boolean)})
      });
      if (!r.ok) throw new Error('OpenAI: '+r.status+' '+await r.text());
      const j = await r.json();
      return j.choices?.[0]?.message?.content?.trim() || '';
    }
    // puter (default)
    await this.loadPuter();
    if (!window.puter) throw new Error('Puter.js not available');
    const messages = [system?{role:'system',content:system}:null,{role:'user',content:prompt}].filter(Boolean);
    const resp = await window.puter.ai.chat(messages, { model:'gpt-4o-mini' });
    return (resp && (resp.message?.content || resp.toString?.())) || '';
  }
};

FL.route('/ai', ()=>{
  const view = $('#view');
  view.innerHTML = `<div class="container">
    <div class="section-head" style="margin-bottom:16px">
      <div><h2>🤖 AI Lab</h2><p class="muted" style="margin-top:4px">Mini AI tools. Text you enter is sent to the AI provider — don't paste secrets.</p></div>
      <button class="btn btn-ghost btn-sm" id="aiSettings">⚙️ Settings</button>
    </div>
    <div class="grid grid-3">
      ${[
        {id:'rewriter',icon:'✍️',name:'Text Rewriter',desc:'Rewrite text to be clear, concise or formal'},
        {id:'summarizer',icon:'📝',name:'Summarizer',desc:'Condense long text into key points'},
        {id:'translator',icon:'🌐',name:'Translator',desc:'Translate to any language'},
        {id:'grammar',icon:'✅',name:'Grammar Checker',desc:'Fix grammar and typos'},
        {id:'email',icon:'📧',name:'Email Writer',desc:'Draft professional emails from bullet points'},
        {id:'regex',icon:'🧬',name:'Regex Generator',desc:'Describe a pattern → get regex'},
        {id:'sql',icon:'🗄️',name:'SQL Generator',desc:'Natural language → SQL query'},
        {id:'explain',icon:'💡',name:'Code Explainer',desc:'Paste code → get an explanation'},
        {id:'prompt',icon:'🎯',name:'Prompt Generator',desc:'Turn a task into a great AI prompt'},
      ].map(t=>`<div class="tool-card" onclick="FL.aiTool('${t.id}')"><div class="row"><div class="icon">${t.icon}</div><h3>${t.name}</h3></div><p>${t.desc}</p><div class="foot"><span class="privacy-badge privacy-ai">🔵 AI</span></div></div>`).join('')}
    </div>
    <div id="aiDialog" style="margin-top:24px"></div>
  </div>`;
  $('#aiSettings').addEventListener('click', ()=>{
    const which = prompt(`AI provider — currently: "${FL.ai.provider}"\n\nType "puter" (free, powered by Puter.js — sent to Puter servers)\nor "openai" (uses your key).`, FL.ai.provider);
    if (which === 'puter' || which === 'openai'){ FL.ai.setProvider(which); if (which === 'openai'){ const k = prompt('Paste your OpenAI API key (stored in your browser only):', FL.ai.key); if (k) FL.ai.setKey(k); } FL.toast('Provider set to '+which, 'ok'); }
  });
});

FL.aiTool = (kind) => {
  const box = $('#aiDialog');
  const configs = {
    rewriter: {label:'Text to rewrite', system:'You are an editor. Rewrite for clarity and concision. Keep the original language. Return only the rewritten text.', extra:{tone:['professional','friendly','concise','executive']}},
    summarizer: {label:'Text to summarize', system:'Summarize the following in 5 bullet points, in the same language as the input.'},
    translator: {label:'Text to translate', system:'', extra:{target:['English','Vietnamese','Japanese','Korean','Chinese','French','Spanish','German']}, prompt: (t,ex) => `Translate the following to ${ex.target}. Return only the translation, no preface.\n\n${t}`},
    grammar: {label:'Text to check', system:'Fix grammar, spelling, and awkward phrasing. Keep the original meaning and language. Return only the corrected text.'},
    email: {label:'Bullet points / notes', system:'Write a professional email based on these notes. Use appropriate greeting and sign-off. Match the requested tone.', extra:{tone:['professional','friendly','apologetic','urgent']}},
    regex: {label:'Describe the pattern in plain English', system:'Return only a regex (JavaScript flavor) that matches the described pattern. On a second line, provide 3 example matches and 3 non-matches.'},
    sql: {label:'Describe the query in plain English', system:'Return a single SQL query (PostgreSQL flavor). No preface. If ambiguous, choose a reasonable schema and note assumptions as SQL comments.'},
    explain: {label:'Code to explain', system:'Explain what this code does step by step, then list any bugs or improvements.'},
    prompt: {label:'Task you want AI to do', system:'Rewrite this as a great AI prompt: clear goal, role, format, constraints. Return only the improved prompt.'}
  };
  const c = configs[kind]; if (!c) return;
  const extras = c.extra ? Object.entries(c.extra).map(([k,vals])=>`<div class="field"><label>${k}</label><select id="ai_${k}">${vals.map(v=>`<option>${v}</option>`).join('')}</select></div>`).join('') : '';
  box.innerHTML = `<div class="card">
    <h3>${kind}</h3>
    <div class="tool-body">
      <div class="field"><label>${c.label}</label><textarea id="aiIn" rows="6" placeholder="Paste text here…"></textarea></div>
      ${extras}
      <div><button class="btn btn-primary" id="aiRun">Run</button> <button class="btn btn-ghost" onclick="document.getElementById('aiDialog').innerHTML=''">Close</button></div>
      <div class="field"><label>Output</label><textarea id="aiOut" rows="8" readonly></textarea><button class="btn btn-ghost btn-sm" onclick="FL.util.copy(document.getElementById('aiOut').value)" style="margin-top:6px">Copy</button></div>
    </div>
  </div>`;
  $('#aiRun').addEventListener('click', async ()=>{
    const inp = $('#aiIn').value.trim(); if (!inp){ FL.toast('Enter some text','warn'); return; }
    const ex = c.extra ? Object.fromEntries(Object.keys(c.extra).map(k=>[k, document.getElementById('ai_'+k).value])) : {};
    const prompt = c.prompt ? c.prompt(inp, ex) : inp + (ex.tone?`\n\n(Tone: ${ex.tone})`:'');
    const btn = $('#aiRun'); btn.disabled=true; btn.innerHTML='<span class="spin"></span> Running…';
    try { const out = await FL.ai.chat(prompt, c.system); $('#aiOut').value = out; }
    catch(e){ $('#aiOut').value = 'Error: '+e.message; FL.toast('AI failed: '+e.message,'err'); }
    btn.disabled=false; btn.innerHTML='Run';
  });
};

/* ============================================================
   TOOL BUILDER — AI creates a sandboxed mini-tool
   ============================================================ */

FL.route('/builder', async ()=>{
  await FL.initDBIfNeeded();
  const params = new URLSearchParams(location.hash.split('?')[1]||'');
  const editId = params.get('id');
  const view = $('#view');
  const list = FL.db ? await FL.db.builtTools.orderBy('updatedAt').reverse().toArray() : [];
  let current = editId ? list.find(x=>x.id===editId) : null;
  view.innerHTML = `<div class="container">
    <div class="section-head"><div><h2>🔧 Tool Builder</h2><p class="muted" style="margin-top:4px">Describe what you need. AI generates a self-contained HTML+JS mini-tool that runs in a sandboxed iframe.</p></div></div>
    <div class="grid grid-2" style="grid-template-columns:300px 1fr">
      <div class="card">
        <h3>My built tools</h3>
        <div id="btList" style="margin-top:10px;display:grid;gap:6px"></div>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;width:100%" id="btNew">+ New</button>
      </div>
      <div class="card">
        <div class="field"><label>Tool name</label><input id="btName" value="${current?esc(current.name):'My New Tool'}"/></div>
        <div class="field" style="margin-top:10px"><label>Describe what the tool should do</label><textarea id="btPrompt" rows="4" placeholder="e.g. Take a list of names and convert them into JSON with fields firstName, lastName">${current?esc(current.prompt||''):''}</textarea></div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" id="btGen">✨ Generate with AI</button>
          <button class="btn btn-ghost" id="btSave">Save</button>
          <button class="btn btn-danger" id="btDel" ${current?'':'disabled style="opacity:.4"'}>Delete</button>
        </div>
        <div class="field" style="margin-top:14px"><label>Generated HTML+JS (sandboxed)</label><textarea id="btCode" rows="12" placeholder="Generated code will appear here…">${current?esc(current.code||''):''}</textarea></div>
        <div class="note warn" style="margin-top:10px">Runs in a sandboxed <code>&lt;iframe&gt;</code> with no access to your data or storage. It cannot read your CVs or workspace.</div>
        <h4 style="margin:16px 0 8px">Preview</h4>
        <iframe id="btFrame" sandbox="allow-scripts" style="width:100%;height:420px;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>
      </div>
    </div>
  </div>`;
  const renderList = async () => {
    const l = FL.db ? await FL.db.builtTools.orderBy('updatedAt').reverse().toArray() : [];
    $('#btList').innerHTML = l.length ? l.map(b=>`<div class="cv-file-item ${current?.id===b.id?'active':''}" onclick="location.hash='#/builder?id=${b.id}'"><span>🔧</span><span class="n">${esc(b.name)}</span><span class="m">${fmtDate(b.updatedAt)}</span></div>`).join('') : `<div class="empty" style="padding:16px"><div class="em">🔧</div>Nothing built yet</div>`;
  };
  renderList();
  const runFrame = (code) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:14px;margin:0;background:#fff;color:#111}input,textarea,select,button{font-family:inherit;font-size:14px}button{background:#ff6a2b;color:#000;border:0;padding:8px 14px;border-radius:6px;cursor:pointer;margin-top:6px}textarea,input{width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;margin:4px 0}textarea{min-height:80px;font-family:ui-monospace,monospace}</style></head><body>${code}</body></html>`;
    $('#btFrame').srcdoc = html;
  };
  if (current?.code) runFrame(current.code);

  $('#btNew').addEventListener('click', ()=>{ location.hash = '#/builder'; });
  $('#btDel').addEventListener('click', async ()=>{ if(!current||!confirm('Delete this tool?')) return; await FL.db.builtTools.delete(current.id); FL.go('#/builder'); });
  $('#btSave').addEventListener('click', async ()=>{
    const name = $('#btName').value.trim() || 'Untitled tool';
    const code = $('#btCode').value;
    const prompt = $('#btPrompt').value;
    const id = current?.id || uid();
    await FL.db.builtTools.put({ id, name, code, prompt, createdAt: current?.createdAt || Date.now(), updatedAt: Date.now() });
    FL.toast('Saved','ok');
    FL.go('#/builder?id='+id);
  });
  $('#btGen').addEventListener('click', async ()=>{
    const p = $('#btPrompt').value.trim();
    if (!p){ FL.toast('Describe the tool first','warn'); return; }
    const btn = $('#btGen'); btn.disabled=true; btn.innerHTML='<span class="spin"></span> Generating…';
    try {
      const system = 'You are a mini-tool builder. Given a description, produce a SELF-CONTAINED chunk of HTML+inline JavaScript that implements the tool. Rules: (1) Return ONLY the body HTML+script, no <html>/<head>/<body>. (2) No external scripts or fetch(). (3) Read input from local <input>/<textarea>/<select>, write output to a visible element. (4) Escape output when inserting into innerHTML. (5) Keep it simple, single-file, ~50-120 lines. (6) Include a short instruction paragraph at the top.';
      const code = await FL.ai.chat(p, system);
      const clean = code.replace(/^```(?:html)?\n?/,'').replace(/```\s*$/,'').trim();
      $('#btCode').value = clean; runFrame(clean);
      FL.toast('Generated. Click Save to keep it.','ok');
    } catch(e){ FL.toast('AI failed: '+e.message,'err'); }
    btn.disabled=false; btn.innerHTML='✨ Generate with AI';
  });
  $('#btCode').addEventListener('input', debounce(e=>runFrame(e.target.value), 400));
});

/* ============================================================
   Boot
   ============================================================ */
FL.__boot = async function(){
  try {
    await FL.initDB();
    if (typeof FL.registerAllTools === 'function') FL.registerAllTools();
    FL.render();
    if ('serviceWorker' in navigator){
      try { await navigator.serviceWorker.register('sw.js'); } catch(e){}
    }
  } catch(e){
    console.error(e);
    document.getElementById('view').innerHTML = '<div style="padding:40px;color:#f87171"><b>Boot error:</b> '+e.message+'<br><pre>'+(e.stack||'').replace(/</g,'&lt;')+'</pre></div>';
  }
};
// Also boot on DOMContentLoaded as fallback (whichever fires first will register)
if (document.readyState !== 'loading') setTimeout(() => FL.__boot && FL.__boot(), 0);
else document.addEventListener('DOMContentLoaded', () => FL.__boot && FL.__boot());
