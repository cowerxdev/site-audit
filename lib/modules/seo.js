(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const specs = [
    ['title', 'Page title', 2], ['description', 'Meta description', 2], ['h1', 'Main heading', 2],
    ['outline', 'Heading outline', 1], ['alt', 'Image alt text', 2], ['canonical', 'Canonical URL', 1],
    ['robots_meta', 'Robots meta', 2], ['opengraph', 'Open Graph', 1], ['twitter', 'Twitter card', 0],
    ['hreflang', 'Hreflang', 0], ['robots_txt', 'Robots.txt', 1], ['sitemap', 'Sitemap', 1]
  ];
  const c = (name, status, evidence, fix = '') => {
    const [, label, weight] = specs.find(item => item[0] === name);
    return L.check(`seo.${name}`, label, weight, status, evidence, fix);
  };
  const short = (value, max = 100) => L.trim(value, max);
  const meta = (doc, key, value) => L.metaContent(doc, key, value);
  function links(doc, rel) {
    return [...doc.querySelectorAll('link[rel]')].slice(0, 300).filter(el => (el.rel || '').toLowerCase().split(/\s+/).includes(rel));
  }
  function isHtml(result) {
    return /html/i.test(result?.contentType || '') || /^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(result?.text || '');
  }
  function xmlCount(text, name) {
    return (text.match(new RegExp(`<\\s*(?:[\\w.-]+:)?${name}\\b`, 'gi')) || []).length;
  }
  function robotsInfo(text) {
    const sitemaps = [];
    let universal = false;
    let group = [];
    let hasRule = false;
    let rules = 0;
    let blocked = false;
    for (const raw of text.split(/\r?\n/).slice(0, 10000)) {
      const line = raw.replace(/\s*#.*$/, '').trim();
      const pair = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
      if (!pair) { if (!line) { group = []; hasRule = false; } continue; }
      const key = pair[1].toLowerCase();
      const value = pair[2].trim();
      if (key === 'sitemap') { if (value) sitemaps.push(value); continue; }
      if (key === 'user-agent') {
        if (hasRule) { group = []; hasRule = false; }
        group.push(value.toLowerCase());
        universal = group.includes('*');
      } else if (key === 'allow' || key === 'disallow') {
        rules++;
        hasRule = true;
        if (key === 'disallow' && value === '/' && universal) blocked = true;
      }
    }
    return {sitemaps, rules, blocked};
  }
  async function run(ctx) {
    try {
      const doc = ctx.doc;
      const checks = [];
      const data = {outline: []};
      const title = short(doc.querySelector('title')?.textContent, 500);
      checks.push(c('title', !title || title.length > 70 ? 'fail' : title.length >= 30 && title.length <= 60 ? 'pass' : 'warn', title ? `“${short(title, 125)}” (${title.length} characters)` : 'No page title', !title ? 'The homepage has no page title, so its name is missing from browser tabs and search previews.' : `The homepage title is ${title.length} characters, outside the usual 30–60 character range shown in search previews.`));
      const description = meta(doc, 'name', 'description');
      checks.push(c('description', !description ? 'fail' : description.length >= 70 && description.length <= 160 ? 'pass' : 'warn', description ? `“${short(description, 130)}” (${description.length} characters)` : 'No meta description', !description ? 'The homepage has no set search description, so search engines must choose preview text from the page.' : `The homepage search description is ${description.length} characters, outside the usual 70–160 character preview range.`));
      const headings = [...doc.querySelectorAll('h1,h2,h3')].slice(0, 60).map(el => ({level: Number(el.tagName[1]), text: short(el.textContent, 160)}));
      data.outline = headings;
      const h1 = [...doc.querySelectorAll('h1')].slice(0, 2000).map(el => short(el.textContent, 160)).filter(Boolean);
      checks.push(c('h1', h1.length === 1 ? 'pass' : h1.length ? 'warn' : 'fail', h1.length ? `${h1.length} H1: ${h1.slice(0, 3).map(x => `“${short(x, 45)}”`).join(', ')}` : 'No non-empty H1', h1.length ? `The homepage has ${h1.length} main headings, so its primary topic is less clear to readers and search engines.` : 'The homepage has no main heading, so its primary topic is less clear to readers and search engines.'));
      const counts = [1, 2, 3].map(n => headings.filter(h => h.level === n).length);
      let skipped = false;
      let previous = 0;
      for (const h of headings) { if (previous && h.level > previous + 1) skipped = true; previous = h.level; }
      const empty = headings.some(h => !h.text);
      checks.push(c('outline', skipped || empty ? 'warn' : 'pass', `${counts[0]} H1 · ${counts[1]} H2 · ${counts[2]} H3${skipped ? ' · skipped level' : ''}${empty ? ' · empty heading' : ''}`, `The homepage has ${[skipped && 'a skipped heading level', empty && 'an empty heading'].filter(Boolean).join(' and ')}, so its sections are harder to follow with a screen reader.`));
      const images = [...doc.querySelectorAll('img')].slice(0, 400).filter(el => !['0', '1'].includes(el.getAttribute('width')) && !['0', '1'].includes(el.getAttribute('height')));
      const withAlt = images.filter(el => el.hasAttribute('alt')).length;
      const percent = images.length ? Math.round(withAlt / images.length * 100) : 0;
      checks.push(c('alt', !images.length ? 'na' : percent >= 90 ? 'pass' : percent >= 60 ? 'warn' : 'fail', images.length ? `${withAlt} of ${images.length} images have alt (${percent}%)` : 'No images to check', `${images.length - withAlt} of ${images.length} images have no text description, so screen readers cannot explain their content.`));
      const canonical = links(doc, 'canonical')[0]?.getAttribute('href') || '';
      const canonicalUrl = L.absUrl(canonical, ctx.url);
      const absolute = /^https?:\/\//i.test(canonical);
      const pageUrl = L.absUrl(ctx.url, ctx.url);
      const different = absolute && canonicalUrl && pageUrl && canonicalUrl.hostname.toLowerCase() !== pageUrl.hostname.toLowerCase();
      checks.push(c('canonical', !absolute || !canonicalUrl ? 'fail' : different ? 'warn' : 'pass', canonical || 'No canonical link', !canonical ? 'The homepage has no canonical address, so search engines lack a stated preferred URL for this page.' : different ? `The homepage names ${short(canonicalUrl.hostname, 70)} as its preferred host, which differs from this site.` : `The homepage gives ${short(canonical, 70)} as a relative or invalid canonical address, so its preferred URL is unclear.`));
      const robotValues = [...doc.querySelectorAll('meta[name]')].slice(0, 300)
        .filter(el => /^(?:robots|googlebot)$/i.test(el.getAttribute('name') || ''))
        .map(el => el.getAttribute('content') || '').filter(Boolean);
      const directives = robotValues.join(', ');
      checks.push(c('robots_meta', /\bnoindex\b/i.test(directives) ? 'fail' : /\bnofollow\b/i.test(directives) ? 'warn' : 'pass', directives || 'No robots meta restrictions', /\bnoindex\b/i.test(directives) ? "The homepage carries a 'noindex' tag, which tells Google not to list it in search results." : "The homepage carries a 'nofollow' tag, which tells search engines not to follow its links."));
      const ogKeys = ['title', 'description', 'image', 'url'];
      const missingOg = ogKeys.filter(key => !meta(doc, 'property', `og:${key}`));
      checks.push(c('opengraph', !missingOg.length ? 'pass' : missingOg.length === 4 ? 'fail' : 'warn', missingOg.length ? `Missing: ${missingOg.map(x => `og:${x}`).join(', ')}` : 'og:title, og:description, og:image, og:url present', `When the homepage is shared on Facebook or LinkedIn, its preview has no set ${missingOg.join(', ')} because those Open Graph tags are missing.`));
      const card = meta(doc, 'name', 'twitter:card');
      checks.push(c('twitter', card ? 'pass' : 'na', card ? `twitter:card: ${short(card, 60)}` : 'No twitter:card tag'));
      const languages = links(doc, 'alternate').filter(el => el.hasAttribute('hreflang')).slice(0, 40).map(el => el.getAttribute('hreflang'));
      checks.push(c('hreflang', languages.length ? 'pass' : 'na', languages.length ? `hreflang: ${languages.join(', ')}` : 'No hreflang links'));
      let fetches = 0;
      const lookupStarted = Date.now();
      const fetchPath = async path => {
        if (fetches >= 4) return null;
        fetches++;
        try { return await ctx.fetchSameOrigin(path); } catch (_) { return null; }
      };
      const robots = await fetchPath('/robots.txt');
      const validRobots = robots?.status === 200 && !isHtml(robots) && /^(?:text\/plain|text\/|application\/octet-stream|$)/i.test(robots.contentType || '');
      const info = validRobots ? robotsInfo(robots.text || '') : {sitemaps: [], rules: 0, blocked: false};
      checks.push(c('robots_txt', !validRobots ? 'warn' : info.blocked ? 'fail' : 'pass', !validRobots ? 'No robots.txt' : `${info.rules} rules · ${info.sitemaps.length} Sitemap lines${info.blocked ? ' · User-agent: * Disallow: /' : ''}`, !validRobots ? 'The site has no readable robots.txt file, so it gives crawlers no central page access or sitemap directions.' : 'The sitewide robots.txt rule blocks all crawlers from every page, so search engines cannot read the site.'));
      const candidates = [];
      for (const value of info.sitemaps) {
        const u = L.absUrl(value, ctx.url);
        if (u && pageUrl && u.origin === pageUrl.origin) candidates.push(u.pathname + u.search);
      }
      candidates.push('/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml');
      let sitemap = null;
      for (const path of [...new Set(candidates)]) {
        // Four slow sequential lookups can outlast the module's timeout and
        // discard all on-page SEO checks. Keep a short budget for optional URLs.
        if (fetches >= 4 || Date.now() - lookupStarted >= 5500) break;
        const result = await fetchPath(path);
        if (result?.status !== 200 || isHtml(result)) continue;
        const body = result.text || '';
        const kind = /<\s*(?:[\w.-]+:)?sitemapindex\b/i.test(body) ? 'index' : /<\s*(?:[\w.-]+:)?urlset\b/i.test(body) ? 'urlset' : null;
        if (kind) { sitemap = {path, kind, count: xmlCount(body, kind === 'index' ? 'sitemap' : 'loc')}; break; }
      }
      checks.push(c('sitemap', sitemap ? 'pass' : 'warn', sitemap ? `${sitemap.path}: ${sitemap.kind === 'index' ? `index of ${sitemap.count} sitemaps` : `${sitemap.count} URLs`}` : 'No XML sitemap found', 'The site has no reachable sitemap, so search engines have no supplied list of its pages.'));
      return {checks, data};
    } catch (error) {
      return {checks: specs.map(([name]) => c(name, 'na', `Unable to inspect page: ${short(error?.message || error, 100)}`)), data: {outline: []}};
    }
  }
  M.seo = {id: 'seo', label: 'SEO', run};
})(globalThis);
