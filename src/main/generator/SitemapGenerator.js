/**
 * generator/SitemapGenerator.js
 * M.R. Textile CMS
 */

'use strict';

const fs   = require('fs');
const path = require('path');

class SitemapGenerator {
  constructor(websiteRoot, siteUrl) {
    this.websiteRoot = websiteRoot;
    this.siteUrl     = siteUrl.replace(/\/$/, '');
  }

  generate(categories) {
    const today = new Date().toISOString().split('T')[0];

    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'monthly' },
      { loc: '/contact.html', priority: '0.8', changefreq: 'monthly' },
    ];

    const categoryPages = categories.map(cat => ({
      loc:        `/${cat.html_file}`,
      priority:   '0.8',
      changefreq: 'weekly',
      lastmod:    today,
    }));

    const b2bPages = [
      { loc: '/b2b/', priority: '0.9', changefreq: 'monthly' },
      { loc: '/b2b/contact.html', priority: '0.8', changefreq: 'monthly' },
      ...categories.filter(c => c.b2b_html_file).map(cat => ({
        loc:        `/${cat.b2b_html_file}`,
        priority:   '0.8',
        changefreq: 'weekly',
        lastmod:    today,
      })),
    ];

    const allPages = [...staticPages, ...categoryPages, ...b2bPages];

    const urlEntries = allPages.map(p => {
      const lastmod = p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : '';
      return `
  <url>
    <loc>${this.siteUrl}${p.loc}</loc>${lastmod}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

    fs.writeFileSync(path.join(this.websiteRoot, 'sitemap.xml'), xml, 'utf8');
  }
}

module.exports = SitemapGenerator;
