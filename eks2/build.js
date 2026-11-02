const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/resources.json'), 'utf8'));
const PAGE_TEMPLATE = fs.readFileSync(path.join(__dirname, 'templates/page-template.html'), 'utf8');
const HUB_TEMPLATE = fs.readFileSync(path.join(__dirname, 'templates/hub-template.html'), 'utf8');
const OUT = path.join(__dirname, 'output');

function fill(template, vars) {
  return template.replace(/{{(\w+)}}/g, (_, key) => (vars[key] !== undefined ? vars[key] : ''));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// Only build published resources into live pages; drafts are skipped (but still tracked in data for later)
const published = DATA.filter(r => r.status === 'published');

// --- Build individual resource pages ---
published.forEach(r => {
  const fragmentPath = path.join(__dirname, 'fragments', r.fragment);
  const dir = path.join(OUT, r.category, r.slug);
  ensureDir(dir);

  if (fs.existsSync(fragmentPath)) {
    fs.copyFileSync(fragmentPath, path.join(dir, 'tool.html'));
  } else {
    fs.writeFileSync(path.join(dir, 'tool.html'), '<p>Tool file not found: ' + r.fragment + '</p>');
  }

  const related = published
    .filter(x => x.category === r.category && x.slug !== r.slug)
    .map(x => `<a href="/${x.category}/${x.slug}/">${x.title}</a>`)
    .join(' &middot; ');

  const html = fill(PAGE_TEMPLATE, {
    SEO_TITLE: r.seo_title,
    META_DESCRIPTION: r.meta_description,
    CATEGORY: r.category,
    CATEGORY_LABEL: r.category_label,
    SLUG: r.slug,
    TITLE: r.title,
    CTA_LINK: r.cta_link,
    CTA_TEXT: r.cta_text,
    RELATED_LINKS: related ? ('More in ' + r.category_label + ': ' + related) : ''
  });

  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log('Built page:', `/${r.category}/${r.slug}/`);
});

// --- Build category hub pages ---
const categories = [...new Set(published.map(r => r.category))];
categories.forEach(cat => {
  const items = published.filter(r => r.category === cat);
  const label = items[0].category_label;
  const cards = items.map(r =>
    `<a class="card" href="/${r.category}/${r.slug}/"><h3>${r.title}</h3><p>${r.meta_description}</p></a>`
  ).join('\n');

  const html = fill(HUB_TEMPLATE, {
    CATEGORY_LABEL: label,
    RESOURCE_CARDS: cards
  });

  const dir = path.join(OUT, cat);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log('Built hub:', `/${cat}/`);
});

// --- Build sitemap.xml ---
const urls = [
  'https://classroom.ellisknowledgestudio.com/',
  ...categories.map(c => `https://classroom.ellisknowledgestudio.com/${c}/`),
  ...published.map(r => `https://classroom.ellisknowledgestudio.com/${r.category}/${r.slug}/`)
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
ensureDir(OUT);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
console.log('Built sitemap.xml with', urls.length, 'URLs');

console.log('\nDone. ' + published.length + ' resource pages, ' + categories.length + ' hub pages.');
const skipped = DATA.filter(r => r.status !== 'published');
if (skipped.length) {
  console.log('Skipped (draft, not published):', skipped.map(r => r.slug).join(', '));
}

// --- Build homepage ---
const HOME_TEMPLATE = fs.readFileSync(path.join(__dirname, 'templates/home-template.html'), 'utf8');
const ICONS = { math: '🔢', science: '🧪', geography: '🌍', chess: '♟️', language: '🗣️', it: '💻', space: '🪐', quantum: '⚛️' };

const categoryCards = categories.map(cat => {
  const items = published.filter(r => r.category === cat);
  const label = items[0].category_label;
  const count = items.length;
  const icon = ICONS[cat] || '📘';
  return `<a class="card" href="/${cat}/"><span class="icon">${icon}</span><h3>${label}</h3><p>${count} free tool${count === 1 ? '' : 's'} to explore</p></a>`;
}).join('\n');

let plannedCategories = [];
const plannedPath = path.join(__dirname, 'data/planned-categories.json');
if (fs.existsSync(plannedPath)) {
  plannedCategories = JSON.parse(fs.readFileSync(plannedPath, 'utf8'));
}
const soonCards = plannedCategories.map(p =>
  `<div class="soon-card"><h4>${p.label}</h4><p>${p.note}</p><span class="badge">Coming soon</span></div>`
).join('\n');

const homeHtml = fill(HOME_TEMPLATE, {
  CATEGORY_CARDS: categoryCards,
  SOON_CARDS: soonCards
});
fs.writeFileSync(path.join(OUT, 'index.html'), homeHtml);
console.log('Built homepage: /index.html');
