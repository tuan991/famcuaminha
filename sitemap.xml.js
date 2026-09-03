// sitemap-generator.js
class SitemapGenerator {
  generate() {
    const baseUrl = window.location.origin;
    const tools = window.APP_TOOLS || [];
    const pages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      ...tools.map(t => ({ url: t.url, priority: '0.8', changefreq: 'weekly' }))
    ];
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    pages.forEach(p => {
      xml += `  <url>\n    <loc>${baseUrl}${p.url}</loc>\n`;
      xml += `    <priority>${p.priority}</priority>\n`;
      xml += `    <changefreq>${p.changefreq}</changefreq>\n  </url>\n`;
    });
    xml += '</urlset>';
    return xml;
  }
}

// Xuất sitemap khi request /sitemap.xml
if (window.location.pathname === '/sitemap.xml') {
  const generator = new SitemapGenerator();
  document.write(`<pre>${generator.generate()}</pre>`);
}