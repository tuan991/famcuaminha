/**
 * FCMA Global Loader - Injects header, footer, and AI widget to all pages
 * Place this AFTER body tag opens: <script src="assets/loader.js"><\/script>
 */

(function initFCMA() {
  // If already loaded, skip
  if (window.FCMA_LOADED) return;
  window.FCMA_LOADED = true;

  // Inject CSS if not already loaded
  if (!document.querySelector('link[href*="styles.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (function() {
      // Detect current page path to set correct base
      const path = window.location.pathname;
      if (path.includes('/assets/')) return '../assets/styles.css';
      if (path.includes('/blog/')) return '../assets/styles.css';
      return 'assets/styles.css';
    })();
    document.head.appendChild(link);
  }

  // Set theme on load
  const theme = localStorage.getItem('fl-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  // Helper: Inject header
  function injectHeader() {
    const header = document.querySelector('.header');
    if (header) return; // Already exists

    const h = document.createElement('header');
    h.className = 'header';
    h.innerHTML = `
      <a class="brand" href="${getBase()}index.html">
        <img class="brand-logo" src="${getBase()}logo-fcma.png" alt="FCMA" width="28" height="28"/>
        <span>FCMA</span>
      </a>
      <nav id="mainNav" class="nav">
        <a href="${getBase()}index.html">Trang chủ</a>
        <a href="${getBase()}services.html">Dịch vụ</a>
        <a href="${getBase()}ai-lab.html">AI Lab</a>
        <a href="${getBase()}prompts.html">Prompt Library</a>
        <a href="${getBase()}resources.html">Tài nguyên</a>
        <a href="${getBase()}blog.html">Blog</a>
        <a href="${getBase()}about.html">Giới thiệu</a>
        <a href="${getBase()}contact.html" class="btn btn-primary btn-sm">Liên hệ</a>
      </nav>
      <button class="mobile-toggle" id="mobileToggle" aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <button class="icon-btn" onclick="toggleTheme()" title="Toggle theme">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      </button>
    `;
    document.body.insertBefore(h, document.body.firstChild);

    // Mobile toggle
    const nav = h.querySelector('#mainNav');
    h.querySelector('#mobileToggle').addEventListener('click', () => nav.classList.toggle('open'));

    // Scroll effect
    const onScroll = () => h.classList.toggle('scrolled', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Helper: Inject footer
  function injectFooter() {
    const footer = document.querySelector('.footer');
    if (footer) return; // Already exists

    const f = document.createElement('footer');
    f.className = 'footer';
    f.innerHTML = `
      <div class="footer-grid">
        <div>
          <div class="brand" style="margin-bottom:14px">
            <img class="brand-logo" src="${getBase()}logo-fcma.png" alt="FCMA" width="28" height="28"/>
            <span>FCMA <small style="display:block;font-size:11px;font-weight:400;letter-spacing:0">Nền tảng AI & Chuyển đổi số</small></span>
          </div>
          <p style="max-width:36ch;color:var(--muted);font-size:14px;margin-top:8px">Chúng tôi thiết kế, triển khai và tự động hoá quy trình AI cho doanh nghiệp Việt Nam.</p>
          <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
            <a class="btn btn-ghost btn-sm" href="https://zalo.me/0777707390" target="_blank" rel="noopener">💬 Zalo</a>
            <a class="btn btn-ghost btn-sm" href="https://www.facebook.com/famcuaminhaFCMA" target="_blank" rel="noopener">📘 Facebook</a>
            <a class="btn btn-ghost btn-sm" href="tel:+84777707390">📞 Gọi</a>
          </div>
        </div>
        <div>
          <h4>Dịch vụ</h4>
          <ul style="list-style:none;margin:0;padding:0">
            <li style="margin-bottom:8px"><a href="${getBase()}services.html#chatbot">AI Chatbot</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}services.html#agent">AI Agent</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}services.html#website">Website AI</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}services.html#automation">Automation</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}services.html#software">Phát triển phần mềm</a></li>
          </ul>
        </div>
        <div>
          <h4>Trung tâm AI</h4>
          <ul style="list-style:none;margin:0;padding:0">
            <li style="margin-bottom:8px"><a href="${getBase()}ai-lab.html">AI Lab</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}prompts.html">Prompt Library</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}resources.html">Tài nguyên</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}case-studies.html">Case Studies</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}blog.html">Blog</a></li>
          </ul>
        </div>
        <div>
          <h4>Công ty</h4>
          <ul style="list-style:none;margin:0;padding:0">
            <li style="margin-bottom:8px"><a href="${getBase()}about.html">Về FCMA</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}contact.html">Liên hệ</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}services.html">Bảng dịch vụ</a></li>
            <li style="margin-bottom:8px"><a href="${getBase()}sitemap.xml">Sitemap</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span id="fyear"></span> FCMA. Nền tảng AI & Automation cho doanh nghiệp Việt.</span>
        <span>famcuaminha.indevs.in</span>
      </div>
    `;
    document.body.appendChild(f);
    f.querySelector('#fyear').textContent = new Date().getFullYear();
  }

  // Helper: Get base path
  function getBase() {
    const path = window.location.pathname;
    // If in subdirectory like /blog/, return ../
    if (path.includes('/blog/')) return '../';
    if (path.includes('/assets/')) return '../';
    return '';
  }

  // Global theme toggle
  window.toggleTheme = function() {
    const current = localStorage.getItem('fl-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('fl-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectHeader();
      injectFooter();
    });
  } else {
    injectHeader();
    injectFooter();
  }
})();
