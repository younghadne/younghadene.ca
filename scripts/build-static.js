#!/usr/bin/env node
/**
 * Static build script for GitHub Pages deployment.
 * Generates sitemap.xml, rss.xml, and blog/posts.json from blog post data.
 *
 * Usage: node scripts/build-static.js
 */

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://younghadene.ca';
const SRC = path.join(__dirname, '..');

function log(msg) { console.log(`[build] ${msg}`); }

// Load blog posts from localStorage backup file or static JSON
function loadPosts() {
  const postsFile = path.join(SRC, 'blog', 'posts.json');
  try {
    return JSON.parse(fs.readFileSync(postsFile, 'utf8'));
  } catch {
    return [];
  }
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Generate sitemap.xml ──
function buildSitemap(posts) {
  const staticPages = [
    { path: '/', priority: '1.0', freq: 'monthly' },
    { path: '/music.html', priority: '0.9', freq: 'monthly' },
    { path: '/blog.html', priority: '0.9', freq: 'weekly' },
    { path: '/contact.html', priority: '0.7', freq: 'monthly' },
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  staticPages.forEach(p => {
    xml += `  <url><loc>${SITE_URL}${p.path}</loc><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>\n`;
  });

  posts.forEach(p => {
    const slug = p.slug || '';
    if (slug) {
      xml += `  <url><loc>${SITE_URL}/blog/${escHtml(slug)}.html</loc>`;
      if (p.date) xml += `<lastmod>${p.date}</lastmod>`;
      xml += `<changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
    }
  });

  xml += '</urlset>';
  fs.writeFileSync(path.join(SRC, 'sitemap.xml'), xml);
  log(`sitemap.xml generated (${staticPages.length + posts.length} URLs)`);
}

// ── Generate rss.xml ──
function buildRss(posts) {
  const sorted = [...posts].sort((a, b) => b.dateNum - a.dateNum).slice(0, 20);
  const pubDate = sorted.length > 0 ? new Date(sorted[0].dateNum).toUTCString() : new Date().toUTCString();

  let rss = '<?xml version="1.0" encoding="UTF-8"?>\n';
  rss += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n';
  rss += '  <channel>\n';
  rss += `    <title>Young Hadene Blog</title>\n`;
  rss += `    <link>${SITE_URL}</link>\n`;
  rss += `    <description>Young Hadene — Haitian-Toronto Drill &amp; Dark Trap Artist — Blog, Music News, and Toronto Culture</description>\n`;
  rss += `    <language>en-ca</language>\n`;
  rss += `    <lastBuildDate>${pubDate}</lastBuildDate>\n`;
  rss += `    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>\n`;
  rss += `    <image><url>${SITE_URL}/images/poster1.png</url><title>Young Hadene</title><link>${SITE_URL}</link></image>\n`;

  sorted.forEach(p => {
    const slug = p.slug || '';
    const desc = (p.content || '').replace(/[#*>\-\[\]()`]/g, '').trim().substring(0, 300);
    rss += '    <item>\n';
    rss += `      <title>${escHtml(p.title)}</title>\n`;
    rss += `      <link>${SITE_URL}/blog/${escHtml(slug)}.html</link>\n`;
    rss += `      <guid isPermaLink="true">${SITE_URL}/blog/${escHtml(slug)}.html</guid>\n`;
    rss += `      <description>${escHtml(desc)}</description>\n`;
    rss += `      <content:encoded><![CDATA[${p.content || ''}]]></content:encoded>\n`;
    if (p.date) rss += `      <pubDate>${new Date(p.date).toUTCString()}</pubDate>\n`;
    if (p.category) rss += `      <category>${escHtml(p.category)}</category>\n`;
    rss += '    </item>\n';
  });

  rss += '  </channel>\n</rss>';
  fs.writeFileSync(path.join(SRC, 'rss.xml'), rss);
  log(`rss.xml generated (${sorted.length} items)`);
}

// ── Main ──
const posts = loadPosts();
buildSitemap(posts);
buildRss(posts);
log('Build complete!');
