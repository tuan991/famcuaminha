# FCMA v0.1.0 — MVP

**Your browser. Your tools. Your workspace.**

A single-page, no-build web toolbox with 40+ working tools, a CV Studio, an AI Lab, and a Tool Builder — everything running client-side.

## Live features (Phase 1-6 complete)

- **40 fully functional tools** across 8 categories: Developer, Text, Data, File & PDF, Image, Network, Generator, AI Lab
- **CV Studio** — live editor, 3 templates (Classic, Modern, Minimal), 8 accent colors, autosave to IndexedDB, one-click PDF export via print dialog, HTML export, AI rewrite for summary
- **Command Palette** — `Ctrl/Cmd + K` from anywhere, fuzzy-searches tools + navigation + recent + favorites
- **AI Lab** — 9 AI mini-tools (rewriter, summarizer, translator, grammar, email, regex, SQL, code explainer, prompt generator) — defaults to free Puter.js; user can plug their own OpenAI key
- **Tool Builder** — describe a tool in plain language → AI generates HTML+JS → runs in a `sandbox`-scoped iframe (no access to your data)
- **Workspace** — favorites, recently used, saved CVs, built tools, one-file JSON backup export/import
- **Privacy Center** — every tool tagged 🟢 Local / 🟡 Remote / 🔵 AI, with a clear listing per bucket
- **PWA** — service worker caches shell, works offline for all local tools
- **Dark/Light theme** — toggle via header button
- **Router** — hash-based (`#/tools/json-formatter`), works on GitHub Pages / any static host
- **Local-first storage** — IndexedDB via Dexie (large data) + localStorage (favorites, theme)

## Tool list (40)

**Developer (13):** JSON Formatter, JSON→CSV, CSV→JSON, JSON Diff, Base64, URL Encode, HTML Entity, Hash (SHA-1/256/384/512), JWT Decoder, Regex Tester, Timestamp Converter, Color Converter, SQL Formatter

**Text (7):** Word Counter, Case Converter, Sort/Dedupe Lines, Find & Replace, Text Diff, Slugify, Markdown Preview

**Data (3):** YAML⇄JSON, CSV Viewer, SQL Playground (sql.js SQLite WASM)

**File & PDF (6):** PDF Merge, PDF Split/Extract, PDF Rotate, Images→PDF, PDF Metadata Viewer/Cleaner, PDF Watermark

**Image (2):** Image Compressor/Resizer, Image⇄Base64

**Network (5):** URL Parser, DNS Lookup (Cloudflare DoH), User Agent Parser, HTTP Status Codes reference, cURL Generator

**Generator (4):** UUID, Password Generator, Lorem Ipsum, QR Code Generator

**AI Lab (9):** Text Rewriter, Summarizer, Translator, Grammar Checker, Email Writer, Regex Generator, SQL Generator, Code Explainer, Prompt Generator

## Architecture

```
FCMA/
├── index.html          # Shell + design system (CSS)
├── app.js              # Router, storage, palette, CV Studio, AI Lab, Builder, Workspace
├── tools.js            # Tool registry (40 tools, plugin-style)
├── manifest.webmanifest# PWA manifest
├── sw.js               # Service worker
└── README.md
```

**Tech choices**
- Vanilla JS + web APIs only. No React/Vite/build step.
- CDN libraries loaded on-demand:
  - [Dexie](https://dexie.org) — IndexedDB wrapper (Apache-2.0)
  - [pdf-lib](https://pdf-lib.js.org) — PDF ops (MIT), lazy-loaded when a PDF tool opens
  - [sql.js](https://sql.js.org) — SQLite WASM (MIT), lazy-loaded for SQL Playground
  - [qrcode](https://github.com/soldair/node-qrcode) — QR generation (MIT)
  - [Puter.js](https://js.puter.com) — free AI (MIT), lazy-loaded for AI tools

**Tool registry API**
```js
FL.registerTool({
  id: 'my-tool',           // unique
  name: 'My Tool',
  desc: 'What it does',
  icon: '⚡',
  category: 'developer',   // matches FL.categories
  privacy: 'local',        // 'local' | 'remote' | 'ai'
  tags: ['keyword'],
  mount(el) { /* render your tool into el */ }
});
```

## Deploy

Any static host works — GitHub Pages, Netlify, Vercel, Cloudflare Pages, or your own server.

```bash
# GitHub Pages
git init && git add . && git commit -m 'FCMA v0.1'
git remote add origin git@github.com:you/FCMA.git
git push -u origin main
# In repo settings → Pages → Source: main / (root)
```

Local dev:
```bash
python3 -m http.server 8080   # or: npx serve .
```

## Roadmap (Phase 7-12)

### Phase 7 — Advanced File & Docs
- [ ] PDF Compress (server-free via image-conversion trick)
- [ ] PDF Annotate + Sign (draw signature on canvas → embed)
- [ ] PDF Form Filler (pdf-lib acroForm API)
- [ ] Excel viewer/editor via SheetJS
- [ ] DOCX text extractor (mammoth.js in worker)

### Phase 8 — Tool Chains
- [ ] Visual chain builder (drag tool nodes → connect)
- [ ] Save chain to workspace, "Run again" with new input
- [ ] Presets: "Clean CSV → dedupe → JSON", "PDF → images → OCR-ready ZIP"

### Phase 9 — Smart file inspector
- [ ] Drop-anywhere zone → detect mime → suggest applicable tools
- [ ] "One input → many tools" panel on the landing hero

### Phase 10 — CV Studio v2
- [ ] 5 more templates (Executive, Creative, Tech, Academic, ATS)
- [ ] CV Job Matcher (compare CV vs job description via AI)
- [ ] Cover Letter Generator
- [ ] Multi-CV comparison

### Phase 11 — Accounts (opt-in only)
- [ ] Supabase-backed cloud sync (opt-in)
- [ ] Share a CV or built tool via link
- [ ] Team workspace

### Phase 12 — Marketplace & polish
- [ ] Public gallery of user-built tools
- [ ] Per-tool star ratings / usage counts (local only)
- [ ] i18n (Vietnamese first, then English)
- [ ] Full mobile bottom-nav

## What's NOT in the MVP yet
- No user accounts / cloud sync — everything is device-local.
- DOCX/XLSX read is limited to what SheetJS Community edition supports; write-back is manual.
- PDF Compress isn't shipped; use PDF Rotate + re-save to reduce metadata bloat.
- Tool chain visual editor deferred to Phase 8; today, chain tools by hand (download from tool A, upload to tool B).

## License

Code in this repo: MIT. See `About` page inside the app for full third-party attribution.

Built browser-side. Your data stays on your device.
