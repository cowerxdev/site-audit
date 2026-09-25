/* Site Auditor: local, read-only checks on the supplied DOM. */
(function (root) {
  'use strict';
  const PORTAL = /portal|sharefile|taxdome|clientaxcess|smartvault|liscio|suralink|karbon|ssportal|safesend|client[\s-]*login|client[\s-]*access|client[\s-]*center|my[\s-]*account(?!ant)|secure[\s-]*(login|client)|canopy|egnyte|citrix|onvio|clientspace|clientwise|fileroom/i;
  const PAY = /pay[\s-]*(online|now|invoice|bill|my|here)|pay[\s-]*(a|your)[\s-]*(bill|invoice)|make[\s-]*a[\s-]*payment|cpacharge|gotobilling|lawpay|paypal|stripe|bill\.com|invoice|authorize\.net|paylink|e-?payment|payments\.(intuit|quickbooks)|quickbooks\.intuit\.com\/pay|square\.link/i;
  const SOCIAL = [['Facebook', /(?:^|\.)facebook\.com/i], ['Instagram', /(?:^|\.)instagram\.com/i], ['LinkedIn', /(?:^|\.)linkedin\.com/i], ['X', /(?:^|\.)x\.com/i], ['Twitter', /(?:^|\.)twitter\.com/i], ['YouTube', /(?:^|\.)youtube\.com/i], ['TikTok', /(?:^|\.)tiktok\.com/i], ['Yelp', /(?:^|\.)yelp\.com/i], ['Google Maps', /(?:^|\.)google\.com\/maps|(?:^|\.)g\.page/i]];
  const trim = (value, max = 120) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const check = (id, label, weight, status, evidence) => ({id, label, status, evidence, weight});

  function meta(doc, key, value) {
    return [...doc.querySelectorAll('meta')].find(el => (el.getAttribute(key) || '').toLowerCase() === value.toLowerCase());
  }

  function collectLinks(doc) {
    const links = [];
    for (const el of doc.querySelectorAll('a[href], iframe[src], form[action], button')) {
      links.push({href: el.getAttribute('href') || el.getAttribute('src') || el.getAttribute('action') || '', text: trim(el.textContent, 120)});
    }
    return links;
  }

  function matchingLink(links, regex) {
    return links.find(link => regex.test(link.text) || regex.test(link.href));
  }

  function linkEvidence(link, regex) {
    if (regex.test(link.text)) return trim(link.text, 40);
    const href = trim(link.href.replace(/^https?:\/\/(www\.)?/i, ''), 50);
    const text = trim(link.text, 30);
    return text ? `${text} (${href})` : href;
  }

  function schemaData(doc) {
    const types = new Set();
    const dates = new Set();
    let parsed = false;
    let visited = 0;
    function visit(value) {
      if (++visited > 10000 || !value || typeof value !== 'object') return;
      if (Array.isArray(value)) { for (const item of value) visit(item); return; }
      const found = value['@type'];
      for (const type of Array.isArray(found) ? found : found ? [found] : []) {
        if (typeof type === 'string') types.add(type.split('/').pop());
      }
      if (typeof value.dateModified === 'string') dates.add(trim(value.dateModified, 40));
      for (const [key, item] of Object.entries(value)) {
        if (key !== '@type' && key !== 'dateModified') visit(item);
      }
    }
    for (const script of doc.querySelectorAll('script[type="application/ld+json" i]')) {
      try { visit(JSON.parse(script.textContent)); parsed = true; } catch (_) { /* invalid JSON-LD is ignored */ }
    }
    return {types: [...types], dates: [...dates], parsed};
  }

  function stackInfo(doc) {
    const generator = meta(doc, 'name', 'generator')?.getAttribute('content') || '';
    const signals = [];
    for (const tag of ['script', 'link', 'img']) {
      let count = 0;
      for (const el of doc.querySelectorAll(tag)) {
        if (++count > 400) break;
        const source = el.getAttribute('src') || el.getAttribute('href');
        if (source) signals.push(source);
      }
    }
    const definitions = [
      ['WordPress', /WordPress/i, /\/wp-content\/|\/wp-includes\//i],
      ['Wix', /Wix/i, /static\.wixstatic\.com|parastorage\.com/i],
      ['Squarespace', /Squarespace/i, /static1\.squarespace\.com|squarespace-cdn/i],
      ['GoDaddy Website Builder', /Starfield|GoDaddy/i, /img1\.wsimg\.com/i],
      ['Weebly', /Weebly/i, /weebly\.com|editmysite\.com/i],
      ['Shopify', /Shopify/i, /cdn\.shopify\.com|Shopify\.theme/i],
      ['Duda', /Duda/i, /dudamobile|irp\.cdn-website\.com/i],
      ['Joomla', /Joomla/i, null], ['Drupal', /Drupal/i, null]
    ];
    for (const [name, gen, signal] of definitions) {
      if (gen.test(generator)) return {name, evidence: trim(generator, 100)};
      const found = signal && signals.find(value => signal.test(value));
      if (found) return {name, evidence: trim(found, 100)};
      if (name === 'Shopify') {
        const inline = [...doc.querySelectorAll('script:not([src])')].slice(0, 400).find(el => /Shopify\.theme/.test(el.textContent));
        if (inline) return {name, evidence: 'Shopify.theme'};
      }
    }
    return null;
  }

  function audit(doc, url, currentYear) {
    if (doc.contentType === 'application/pdf') throw new Error('PDF documents are not auditable');
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./i, '');
    const checks = [];
    checks.push(check('https', 'Secure connection', 3, parsedUrl.protocol === 'https:' ? 'pass' : 'fail', parsedUrl.protocol === 'https:' ? 'Served over HTTPS' : "Served over plain HTTP — browsers mark it 'Not secure'"));
    const viewport = meta(doc, 'name', 'viewport');
    checks.push(check('viewport', 'Mobile viewport', 3, viewport ? 'pass' : 'fail', viewport ? trim(viewport.getAttribute('content')) : 'No mobile viewport tag — the site renders as a shrunken desktop page on phones'));
    const links = collectLinks(doc);
    const portal = matchingLink(links, PORTAL);
    checks.push(check('portal', 'Client portal', 1, portal ? 'pass' : 'warn', portal ? linkEvidence(portal, PORTAL) : 'No client portal or login link'));
    const payment = matchingLink(links, PAY);
    checks.push(check('payment', 'Online payment', 1, payment ? 'pass' : 'warn', payment ? linkEvidence(payment, PAY) : 'No online payment link'));
    const schema = schemaData(doc);
    const social = [];
    for (const link of doc.querySelectorAll('a[href]')) {
      try {
        const destination = new URL(link.getAttribute('href'), url);
        const match = SOCIAL.find(([, pattern]) => pattern.test(destination.hostname + destination.pathname));
        if (match && !social.includes(match[0])) social.push(match[0]);
      } catch (_) { /* malformed href */ }
    }
    checks.push(check('social', 'Social links', 0, social.length ? 'pass' : 'na', social.length ? social.join(', ') : 'No social links'));
    const hints = [];
    for (const property of ['article:modified_time', 'og:updated_time']) {
      const value = meta(doc, 'property', property)?.getAttribute('content');
      if (value) hints.push(`${property}: ${trim(value, 35)}`);
    }
    if (schema.dates.length) hints.push(`dateModified: ${schema.dates[0]}`);
    const generator = meta(doc, 'name', 'generator')?.getAttribute('content');
    if (/WordPress/i.test(generator || '')) hints.push(trim(generator, 50));
    checks.push(check('freshness', 'Update hints', 0, hints.length ? 'pass' : 'na', hints.length ? trim(hints.join('; '), 150) : 'No last-modified hints in the page'));
    const scored = checks.filter(item => item.status !== 'na' && item.weight);
    const denominator = scored.reduce((sum, item) => sum + item.weight, 0);
    const score = denominator ? Math.round(scored.reduce((sum, item) => sum + item.weight * (item.status === 'pass' ? 1 : item.status === 'warn' ? .5 : 0), 0) / denominator * 100) : 0;
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    return {url, host, score, grade, stack: stackInfo(doc), checks, meta: {title: trim(doc.title, 160), auditedAt: new Date().toISOString()}};
  }

  root.SiteAuditorChecks = {audit, collectLinks};
  if (typeof module !== 'undefined') module.exports = root.SiteAuditorChecks;
})(globalThis);
