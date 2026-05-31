#!/usr/bin/env node

/**
 * YOUNG HADENE — AI Blog Post Generator
 *
 * Usage:
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/generate-post.js
 *
 * Optional:
 *   DEEPSEEK_BASE_URL  (default: https://api.deepseek.com)
 *   DEEPSEEK_MODEL     (default: deepseek-chat)
 *
 * Schedule daily via cron (macOS/Linux):
 *   0 9 * * * cd /path/to/site && DEEPSEEK_API_KEY=sk-xxx /usr/local/bin/node scripts/generate-post.js >> logs/blog.log 2>&1
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Load .env if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const [k, ...v] = line.split('=');
    if (k && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
  }
}

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

if (!API_KEY) {
  console.error('❌ Set DEEPSEEK_API_KEY env var   (Get one: https://platform.deepseek.com/api_keys)');
  process.exit(1);
}

const client = new OpenAI({ baseURL: BASE_URL, apiKey: API_KEY });

// ── Pre-written keyword bank ──
const KEYWORDS = [
  { kw: 'Toronto drill artists 2026', cat: 'Music' },
  { kw: 'underground Canadian hip hop', cat: 'Music' },
  { kw: 'Haitian musicians in Toronto', cat: 'Toronto' },
  { kw: 'dark trap music scene', cat: 'Music' },
  { kw: 'independent rappers Canada 2026', cat: 'Music' },
  { kw: 'Toronto rap studio culture', cat: 'Studio Sessions' },
  { kw: 'Haitian-Toronto music fusion', cat: 'Toronto' },
  { kw: 'how to promote underground rap', cat: 'Behind The Scenes' },
  { kw: 'Toronto drill beat production', cat: 'Studio Sessions' },
  { kw: 'best Canadian rap 2026', cat: 'Music' },
  { kw: 'Toronto music venues history', cat: 'Toronto' },
  { kw: 'rap artist branding tips 2026', cat: 'Lifestyle' },
  { kw: 'Caribbean influence on drill music', cat: 'Toronto' },
  { kw: 'Spotify playlist pitching for rappers', cat: 'Behind The Scenes' },
  { kw: 'Toronto hip hop producers 2026', cat: 'Music' },
  { kw: 'drill music storytelling techniques', cat: 'Studio Sessions' },
  { kw: 'Haitian Canadian artists to know', cat: 'Toronto' },
  { kw: 'how to grow rap audience on YouTube', cat: 'Behind The Scenes' },
  { kw: 'melodic drill rap artists', cat: 'Music' },
  { kw: 'underground rap visual branding', cat: 'Lifestyle' },
];

// ── Helpers ──
function usedTitles() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'blog.html'), 'utf8');
    const m = raw.match(/title:\s*'([^']+)'/g);
    return m ? m.map(x => x.split("'")[1].toLowerCase()) : [];
  } catch { return []; }
}

function pickKw(used) {
  const free = KEYWORDS.filter(k => !used.some(u => u.includes(k.kw.split(' ')[0].toLowerCase())));
  return (free.length ? free : KEYWORDS)[Math.floor(Math.random() * (free.length || KEYWORDS.length))];
}

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 60); }
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ── Load HTML template (header + footer from existing article) ──
function loadTemplate() {
  const tplPath = path.join(__dirname, '..', 'blog', 'top-toronto-rappers.html');
  const tpl = fs.readFileSync(tplPath, 'utf8');
  const headEnd = tpl.indexOf('</head>');
  const bodyEnd = tpl.lastIndexOf('<footer');
  return {
    head: tpl.substring(0, headEnd),
    header: tpl.substring(tpl.indexOf('<header'), tpl.indexOf('</header>') + 9),
    footer: tpl.substring(tpl.indexOf('<footer'), tpl.indexOf('</footer>') + 9),
    footEnd: tpl.substring(tpl.indexOf('</footer>') + 9),
  };
}

// ── Generate via DeepSeek ──
async function genArticle(kw, cat) {
  const prompt = `You are a hip-hop culture writer for younghadene.ca — the site of Young Hadene, a Haitian-Toronto drill/dark trap artist.

Write a 600-900 word SEO article targeting: "${kw}"

Rules:
- Use "${kw}" 3-5 times naturally
- Mention Young Hadene at least twice as a real example
- Include "Haitian-Toronto" at least once
- Voice: confident, street-aware, professional, no fluff
- Short paragraphs (2-4 sentences)
- Use **bold** for H2 headings and *bold* for H3 subheadings
- End pointing to younghadene.ca as a resource

OUTPUT (exact format):
TITLE: [title with keyword]
EXCERPT: [max 200 chars]
BODY:
[full text]`;

  const r = await client.chat.completions.create({
    model: MODEL, messages: [{ role: 'user', content: prompt }],
    temperature: 0.8, max_tokens: 2200,
  });
  return r.choices[0].message.content;
}

function parse(raw, kw) {
  const t = raw.match(/TITLE:\s*(.+)/), e = raw.match(/EXCERPT:\s*(.+)/), b = raw.match(/BODY:\s*([\s\S]+)/);
  return {
    title: t ? t[1].trim() : `What to Know About ${kw} in 2026`,
    excerpt: e ? e[1].trim() : `A deep dive into ${kw}.`,
    body: b ? b[1].trim() : raw,
  };
}

function fmt(body) {
  return body.split('\n').filter(l => l.trim()).map(l => {
    const t = l.trim();
    if (t.startsWith('**') && t.endsWith('**')) return `<h2>${t.replace(/\*\*/g, '')}</h2>`;
    if (t.startsWith('*') && t.endsWith('*') && !t.startsWith('**')) return `<h3>${t.replace(/\*/g, '')}</h3>`;
    return `<p>${t}</p>`;
  }).join('\n');
}

// ── Save ──
function save(article, kw, cat) {
  const slug = slugify(article.title);
  const now = new Date();
  const ds = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dn = now.getTime();
  const id = dn;

  const tpl = loadTemplate();

  const html = `${tpl.head}
  <title>${esc(article.title)}</title>
  <meta name="description" content="${esc(article.excerpt)}">
  <link rel="canonical" href="https://younghadene.ca/blog/${slug}.html">
  <meta property="og:title" content="${esc(article.title)}">
  <meta property="og:description" content="${esc(article.excerpt)}">
  <meta property="og:image" content="https://younghadene.ca/images/poster1.png">
  <meta property="og:type" content="article">
  <script type="application/ld+json">
  { "@context": "https://schema.org", "@type": "Article",
    "headline": "${esc(article.title)}",
    "description": "${esc(article.excerpt)}",
    "author": { "@type": "MusicGroup", "name": "Young Hadene" },
    "datePublished": "${ds}",
    "image": "https://younghadene.ca/images/poster1.png" }
  </script>
</head>
<body>
${tpl.header}
  <section class="section" style="padding-top:120px;">
    <div class="container">
      <a href="../blog.html" class="back-link">&#8592; Back to Blog</a>
      <div class="article-wrap">
        <div class="meta">${ds} &middot; <span>${esc(cat)}</span></div>
        <h1>${esc(article.title)}</h1>
        ${fmt(article.body)}
      </div>
    </div>
  </section>
${tpl.footer}
${tpl.footEnd}
`;

  // Write file
  const blogDir = path.join(__dirname, '..', 'blog');
  if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir);
  fs.writeFileSync(path.join(blogDir, `${slug}.html`), html);
  console.log(`✅ blog/${slug}.html`);

  // Inject into blog.html DEFAULT_POSTS
  const bp = path.join(__dirname, '..', 'blog.html');
  let bhtml = fs.readFileSync(bp, 'utf8');
  const entry = `{ id: ${id}, title: '${esc(article.title).replace(/'/g, "\\'")}', slug: '${slug}', category: '${esc(cat)}', date: '${ds}', dateNum: ${dn}, featured: false, content: '${esc(article.excerpt).replace(/'/g, "\\'")}' }`;
  bhtml = bhtml.replace('const DEFAULT_POSTS = [', `const DEFAULT_POSTS = [\n      ${entry},`);
  fs.writeFileSync(bp, bhtml);
  console.log(`✅ blog.html updated`);

  // Update sitemap
  const sp = path.join(__dirname, '..', 'sitemap.xml');
  let sm = fs.readFileSync(sp, 'utf8');
  const u = `  <url>\n    <loc>https://younghadene.ca/blog/${slug}.html</loc>\n    <lastmod>${now.toISOString().split('T')[0]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  sm = sm.replace('</urlset>', `${u}\n</urlset>`);
  fs.writeFileSync(sp, sm);
  console.log(`✅ sitemap.xml updated`);

  return slug;
}

// ── Main ──
async function main() {
  console.log('🎤 Young Hadene Blog Generator');
  console.log(`Model: ${MODEL}`);

  const used = usedTitles();
  const target = pickKw(used);
  console.log(`Target: "${target.kw}" [${target.cat}]`);

  const raw = await genArticle(target.kw, target.cat);
  const art = parse(raw, target.kw);
  const slug = save(art, target.kw, target.cat);

  console.log(`\n🎉 Published: ${art.title}`);
  console.log(`   https://younghadene.ca/blog/${slug}.html`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
