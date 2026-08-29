/* =====================================================
   FCMA — Shared app: header partial, footer, AI widget,
   reveal observer, small helpers.
   ===================================================== */

const FCMA = {
  brand: 'FCMA',
  domain: 'famcuaminha.indevs.in',
  phone: '0777707390',
  phoneRaw: '0777707390',
  phoneIntl: '+84777707390',
  zalo: 'https://zalo.me/0777707390',
  facebook: 'https://www.facebook.com/famcuaminhaFCMA',
  email: 'famcuaminha@gmail.com',
  logo: 'logo-fcma.png',
  systemPrompt: `Bạn là FCMA AI Assistant, trợ lý AI chính thức của FCMA — công ty chuyên về AI Solutions, AI Automation, Website AI, Workflow Automation, AI Agents, Business Automation và Digital Transformation.

Nhiệm vụ:
- Tư vấn dịch vụ FCMA cho khách hàng bằng tiếng Việt tự nhiên, ngắn gọn (dưới 120 từ mỗi lần).
- Gợi ý dịch vụ phù hợp: AI Chatbot, AI Agent, Website AI, Automation Doanh nghiệp, Content AI, AI Marketing, Workflow Automation, AI Customer Service, Phát triển phần mềm, Chuyển đổi số.
- Nếu khách quan tâm, đề nghị họ liên hệ qua:
  · Zalo/Hotline: 0777 707 390
  · Facebook: https://www.facebook.com/famcuaminhaFCMA
  · Email: famcuaminha@gmail.com
- Không bịa giá cụ thể — nói "được tư vấn theo nhu cầu thực tế".
- Kết thúc bằng 1 câu hỏi để mở rộng cuộc trò chuyện.
Giọng điệu: chuyên nghiệp, thân thiện, tự tin.`
};

/* --------- Header partial --------- */
function renderHeader(active = '', base = '') {
  const links = [
    { href: base + 'index.html', label: 'Trang chủ', key: 'home' },
    { href: base + 'services.html', label: 'Dịch vụ', key: 'services' },
    { href: base + 'ai-lab.html', label: 'AI Lab', key: 'lab' },
    { href: base + 'prompts.html', label: 'Prompt Library', key: 'prompts' },
    { href: base + 'resources.html', label: 'Tài nguyên', key: 'resources' },
    { href: base + 'blog.html', label: 'Blog', key: 'blog' },
    { href: base + 'about.html', label: 'Giới thiệu', key: 'about' }
  ];

  const el = document.createElement('header');
  el.className = 'header';
  el.innerHTML = `
    <div class="container header-inner">
      <a class="brand" href="${base}index.html">
        <img class="brand-logo" src="${base}logo-fcma.png" alt="FCMA — AI Automation Innovation" width="40" height="40"/>
        <span>
          FCMA
          <small>AI · Automation · Digital</small>
        </span>
      </a>
      <nav class="nav" id="mainNav">
        ${links.map(l => `<a href="${l.href}" class="${l.key === active ? 'active' : ''}">${l.label}</a>`).join('')}
        <a href="${base}contact.html" class="btn btn-primary btn-sm nav-cta">Liên hệ</a>
      </nav>
      <button class="mobile-toggle" id="mobileToggle" aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
    </div>
  `;
  document.body.prepend(el);

  const nav = el.querySelector('#mainNav');
  el.querySelector('#mobileToggle').addEventListener('click', () => nav.classList.toggle('open'));

  const onScroll = () => el.classList.toggle('scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* --------- Footer partial --------- */
function renderFooter(base = '') {
  const el = document.createElement('footer');
  el.className = 'footer';
  el.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="brand" style="margin-bottom:14px">
            <img class="brand-logo" src="${base}logo-fcma.png" alt="FCMA" width="40" height="40"/>
            <span>FCMA <small>Nền tảng AI & Chuyển đổi số</small></span>
          </div>
          <p style="max-width:36ch;color:var(--muted);font-size:14px">Chúng tôi thiết kế, triển khai và tự động hoá quy trình AI cho doanh nghiệp Việt Nam.</p>
          <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
            <a class="btn btn-ghost btn-sm" href="${FCMA.zalo}" target="_blank" rel="noopener">💬 Zalo 0777 707 390</a>
            <a class="btn btn-ghost btn-sm" href="${FCMA.facebook}" target="_blank" rel="noopener">📘 Facebook</a>
            <a class="btn btn-ghost btn-sm" href="tel:${FCMA.phoneRaw}">📞 ${FCMA.phone}</a>
          </div>
        </div>
        <div>
          <h4>Dịch vụ</h4>
          <ul>
            <li><a href="${base}services.html#chatbot">AI Chatbot</a></li>
            <li><a href="${base}services.html#agent">AI Agent</a></li>
            <li><a href="${base}services.html#website">Website AI</a></li>
            <li><a href="${base}services.html#automation">Automation</a></li>
            <li><a href="${base}services.html#software">Phát triển phần mềm</a></li>
          </ul>
        </div>
        <div>
          <h4>Trung tâm AI</h4>
          <ul>
            <li><a href="${base}ai-lab.html">AI Lab (miễn phí)</a></li>
            <li><a href="${base}prompts.html">Prompt Library</a></li>
            <li><a href="${base}resources.html">Tài nguyên</a></li>
            <li><a href="${base}case-studies.html">Case Studies</a></li>
            <li><a href="${base}blog.html">Blog AI</a></li>
          </ul>
        </div>
        <div>
          <h4>Công ty</h4>
          <ul>
            <li><a href="${base}about.html">Về FCMA</a></li>
            <li><a href="${base}contact.html">Liên hệ</a></li>
            <li><a href="${base}services.html">Bảng dịch vụ</a></li>
            <li><a href="${base}sitemap.xml">Sitemap</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span id="fyear"></span> FCMA. Nền tảng AI & Automation cho doanh nghiệp Việt.</span>
        <span>${FCMA.domain}</span>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.querySelector('#fyear').textContent = new Date().getFullYear();
}

/* --------- Reveal on scroll --------- */
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

/* --------- AI floating widget (Puter.js) --------- */
function renderAIWidget() {
  const fab = document.createElement('button');
  fab.className = 'ai-fab';
  fab.setAttribute('aria-label', 'Mở FCMA AI Assistant');
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.7 4.7L18 8l-4.3 1.7L12 14l-1.7-4.3L6 8l4.3-1.3z"/><path d="M18 14l1 2.5 2.5 1-2.5 1L18 21l-1-2.5-2.5-1 2.5-1z"/><path d="M6 14l.8 2 2 .8-2 .8L6 19.6l-.8-2-2-.8 2-.8z"/></svg>`;
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'ai-panel';
  panel.innerHTML = `
    <div class="ai-header">
      <span class="dot"></span>
      <div>
        <div class="title">FCMA AI Assistant</div>
        <div class="sub">Tư vấn AI · Automation · Website</div>
      </div>
      <button class="ai-close" aria-label="Đóng">✕</button>
    </div>
    <div class="ai-body" id="aiBody">
      <div class="ai-msg bot">Xin chào 👋 Tôi là trợ lý AI của FCMA. Bạn cần tư vấn về giải pháp AI, tự động hoá hay website?</div>
    </div>
    <div class="ai-suggests" id="aiSuggests">
      <button data-q="Tôi muốn làm chatbot AI cho shop">Chatbot cho shop</button>
      <button data-q="Tư vấn automation doanh nghiệp">Automation</button>
      <button data-q="Chi phí làm Website AI thế nào">Chi phí Website AI</button>
      <a href="${FCMA.zalo}" target="_blank" rel="noopener" style="text-decoration:none">
        <button style="background:linear-gradient(135deg,rgba(110,231,255,.15),rgba(124,92,255,.15));border-color:rgba(110,231,255,.4);color:var(--primary)">💬 Nhắn Zalo trực tiếp</button>
      </a>
      <a href="${FCMA.facebook}" target="_blank" rel="noopener" style="text-decoration:none">
        <button style="background:rgba(59,89,152,.15);border-color:rgba(59,89,152,.5);color:#8ab4f8">📘 Facebook</button>
      </a>
    </div>
    <form class="ai-input" id="aiForm">
      <input type="text" id="aiInput" placeholder="Nhập câu hỏi..." autocomplete="off"/>
      <button type="submit" aria-label="Gửi">➤</button>
    </form>
  `;
  document.body.appendChild(panel);

  const body = panel.querySelector('#aiBody');
  const input = panel.querySelector('#aiInput');
  const form = panel.querySelector('#aiForm');
  const history = [{ role: 'system', content: FCMA.systemPrompt }];

  const open = () => { panel.classList.add('open'); setTimeout(() => input.focus(), 200); };
  const close = () => panel.classList.remove('open');

  fab.addEventListener('click', () => panel.classList.contains('open') ? close() : open());
  panel.querySelector('.ai-close').addEventListener('click', close);

  const addMsg = (text, role) => {
    const div = document.createElement('div');
    div.className = 'ai-msg ' + (role === 'user' ? 'user' : 'bot');
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  };

  const send = async (q) => {
    if (!q) return;
    addMsg(q, 'user');
    history.push({ role: 'user', content: q });
    const thinking = addMsg('', 'bot');
    thinking.classList.add('thinking');

    try {
      if (!window.puter) throw new Error('AI đang khởi động, vui lòng thử lại sau vài giây.');
      const resp = await window.puter.ai.chat(history, { model: 'gpt-4o-mini' });
      const text = (resp && (resp.message?.content || resp.toString())) || 'Xin lỗi, chưa có phản hồi.';
      thinking.classList.remove('thinking');
      thinking.textContent = text;
      history.push({ role: 'assistant', content: text });
    } catch (err) {
      thinking.classList.remove('thinking');
      thinking.textContent = `⚠️ ${err.message || 'Không kết nối được AI. Vui lòng thử lại.'} Bạn có thể liên hệ Zalo ${FCMA.zalo}.`;
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    send(q);
  });

  panel.querySelector('#aiSuggests').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    send(b.dataset.q);
  });
}

/* --------- Helpers --------- */
function copyText(text, buttonEl) {
  navigator.clipboard.writeText(text).then(() => {
    if (buttonEl) {
      const t = buttonEl.textContent;
      buttonEl.textContent = '✓ Đã copy';
      setTimeout(() => buttonEl.textContent = t, 1400);
    }
  });
}

function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:rgba(11,13,20,.95);color:#fff;padding:12px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.15);z-index:200;font-size:14px;backdrop-filter:blur(20px)';
  document.body.appendChild(t);
  setTimeout(() => t.style.opacity = '0', 1800);
  setTimeout(() => t.remove(), 2200);
}

/* --------- Number counter --------- */
function initCounters() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = +el.dataset.count;
      const dur = 1400;
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('vi-VN') + (el.dataset.suffix || '');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      io.unobserve(el);
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('[data-count]').forEach(el => io.observe(el));
}

/* --------- Boot --------- */
window.FCMA_BOOT = function boot(activeKey, base = '') {
  renderHeader(activeKey, base);
  renderFooter(base);
  initReveal();
  renderAIWidget();
  initCounters();
};

window.FCMA = FCMA;
window.copyText = copyText;
window.toast = toast;
