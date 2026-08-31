const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const siteOrigin = process.env.SEO_SITE_ORIGIN || 'https://pratix.io';
const routePath = process.env.SEO_ROUTE_PATH || '/';
const fallbackTitle = process.env.SEO_TITLE || 'Pratix.io browser tool';
const fallbackDescription = process.env.SEO_DESCRIPTION || 'A practical, private browser-based tool from Pratix.io. No upload is required for everyday work.';
const languages = ['en', 'tr', 'de', 'fr', 'es', 'it', 'nl', 'sv', 'da', 'no', 'fi', 'zh'];
const suffix = {
  en: ' Runs in your browser without uploads. Simple, private, and ready when you are.',
  tr: ' Tarayıcınızda çalışır; yükleme veya sunucu gerektirmez. Hızlı, özel ve kullanıma hazırdır.',
  de: ' Läuft direkt im Browser – ohne Upload und ohne Server. Schnell, einfach und privat.',
  fr: ' Fonctionne directement dans votre navigateur, sans téléversement ni serveur. Rapide, simple et privé.',
  es: ' Funciona directamente en su navegador, sin cargas ni servidor. Rápido, sencillo y privado.',
  it: ' Funziona direttamente nel browser, senza caricamenti né server. Semplice, veloce e privato.',
  nl: ' Werkt direct in je browser, zonder upload of server. Snel, eenvoudig en privé.',
  sv: ' Körs direkt i webbläsaren utan uppladdning eller server. Snabbt, enkelt och privat.',
  da: ' Kører direkte i browseren uden upload eller server. Hurtigt, enkelt og privat.',
  no: ' Kjører direkte i nettleseren uten opplasting eller server. Raskt, enkelt og privat.',
  fi: ' Toimii suoraan selaimessa ilman latausta tai palvelinta. Nopeaa, helppoa ja yksityistä.',
  zh: ' 所有处理都在浏览器本地完成，无需上传文件或连接服务器。快速、简单并注重隐私保护。'
};
function esc(v) { return String(v).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function trim(v, max=155) { const s=String(v||'').replace(/\\s+/g,' ').trim(); if(s.length<=max) return s; const x=s.slice(0,max-1); const i=x.lastIndexOf(' '); return `${x.slice(0,i>=max-30?i:max-1).replace(/[,:;–—-]+$/,'').trim()}.`; }
function copy(html, language) {
  const title = html.match(/<title>([\\s\\S]*?)<\\/title>/i)?.[1] || fallbackTitle;
  let description = html.match(/<meta\\s+name=["']description["']\\s+content=["']([^"']*)["']/i)?.[1] || fallbackDescription;
  description = description.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  if (description.length < 120) description += suffix[language] || suffix.en;
  description = trim(description);
  const canonical = `${siteOrigin}${routePath}`;
  const replacements = [
    [/<title>[\\s\\S]*?<\\/title>/i, `<title>${esc(trim(title, 60))}</title>`],
    [/<meta\\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${esc(description)}">`],
    [/<meta\\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'],
    [/<meta\\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${esc(trim(title, 60))}">`],
    [/<meta\\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${esc(description)}">`],
    [/<meta\\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}">`],
    [/<meta\\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="website">'],
    [/<meta\\s+property=["']og:site_name["'][^>]*>/i, '<meta property="og:site_name" content="Pratix.io">'],
    [/<meta\\s+name=["']twitter:card["'][^>]*>/i, '<meta name="twitter:card" content="summary">'],
    [/<meta\\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${esc(trim(title, 60))}">`],
    [/<meta\\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${esc(description)}">`],
    [/<link\\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}">`],
  ];
  for (const [matcher, replacement] of replacements) html = matcher.test(html) ? html.replace(matcher, replacement) : html.replace(/<\\/head>/i, `  ${replacement}\\n</head>`);
  return { html, title: trim(title, 60), description };
}
function walk(dir, result=[]) { if(!fs.existsSync(dir)) return result; for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name); if(e.isDirectory()) walk(p,result); else if(e.name==='index.html') result.push(p);} return result; }
if (!fs.existsSync(dist)) throw new Error('dist directory missing');
const pages = walk(dist);
for (const file of pages) {
  const relative = path.relative(dist, file).split(path.sep);
  const language = languages.includes(relative[0]) ? relative[0] : 'en';
  const result = copy(fs.readFileSync(file, 'utf8'), language);
  let html = result.html;
  const localeRoot = path.join(dist, language);
  const localePages = walk(localeRoot).filter(p => path.relative(localeRoot,p).split(path.sep).length >= 2);
  const alternates = [];
  for (const candidate of languages) {
    const candidateRoot = path.join(dist, candidate);
    const candidates = walk(candidateRoot).filter(p => path.relative(candidateRoot,p).split(path.sep).length >= 2);
    if (candidate === language || (candidateRoot && candidates.length)) {
      const currentSlug = relative[0] === candidate ? relative.slice(1,-1).join('/') : null;
      const match = currentSlug ? path.join(candidateRoot, currentSlug, 'index.html') : null;
      const href = match && fs.existsSync(match) ? `${siteOrigin}/${candidate}/${currentSlug}` : `${siteOrigin}${routePath}`;
      alternates.push(`  <link rel="alternate" hreflang="${candidate}" href="${href}" data-seo-hreflang="true">`);
    }
  }
  if (alternates.length) { alternates.push(`  <link rel="alternate" hreflang="x-default" href="${siteOrigin}${routePath}" data-seo-hreflang="true">`); html = html.replace(/<\\/head>/i, `${alternates.join('\\n')}\\n</head>`); }
  fs.writeFileSync(file, html);
}
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\\nAllow: /\\n`);
console.log(`SEO postprocessed ${pages.length} static pages`);
