# FCMA — AI, Automation & Digital Transformation Platform

Nền tảng thương hiệu FCMA tại **famcuaminha.indevs.in**.

## Kiến trúc
Static HTML/CSS/JS thuần — không cần build step, deploy được trực tiếp trên GitHub Pages.

### Trang
- `index.html` — Trang chủ
- `about.html` — Giới thiệu, tầm nhìn, sứ mệnh
- `services.html` — 10 dịch vụ chi tiết
- `ai-lab.html` — **7 công cụ AI chạy trực tiếp bằng Puter.js (miễn phí)**
- `prompts.html` — Thư viện 30+ prompt, tìm kiếm + lưu yêu thích
- `resources.html` — Ebook, checklist, template (email gate)
- `case-studies.html` — 3 case study với số liệu
- `blog.html` + `blog/*.html` — 3 bài SEO chuẩn
- `contact.html` — Form + Zalo + hotline
- `404.html` — Trang không tìm thấy custom

### Assets
- `assets/style.css` — Design system Apple/Linear/Vercel
- `assets/app.js` — Header/Footer partial + AI Widget + reveal observer
- `assets/blog.css` — Style riêng cho blog
- `assets/prompts.json` — Dữ liệu prompt library
- `logo-fcma.png` — Logo chính
- `favicon.png` — Favicon
- `sitemap.xml` · `robots.txt` · `manifest.webmanifest` · `CNAME`

## AI Stack (100% miễn phí)
- **[Puter.js](https://js.puter.com/v2/)** — GPT-4o mini chạy client-side, không cần API key
- **LocalStorage** — Lưu prompt yêu thích, kết quả AI Lab, lead từ form
- **Formspree fallback** — Form submit fallback bằng `mailto:`

## Deploy
Chỉ cần commit lên branch `main` — GitHub Pages đã trỏ `CNAME` sang `famcuaminha.indevs.in`.

## SEO
- Meta title/description/canonical mọi trang
- Open Graph + Twitter Card
- Schema.org JSON-LD (Organization + Article)
- `sitemap.xml`, `robots.txt`

## Local dev
Không cần build. Mở file bằng bất kỳ static server:
```bash
python3 -m http.server 8080
# hoặc
npx serve .
```

---
© FCMA · Nền tảng AI & Automation cho doanh nghiệp Việt.
