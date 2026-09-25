/* Site Auditor shared helpers. Loaded before every module; no network, no side effects. */
(function (root) {
  'use strict';
  const trim = (value, max = 120) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  // Check shape used by every module. id is '<module>.<name>'; status is pass | warn | fail | na;
  // weight 0-3 (0 = informational, never scored); fix is one plain sentence for the pitch draft, or ''.
  function check(id, label, weight, status, evidence, fix = '') {
    return {id, label, weight, status, evidence: trim(evidence, 200), fix: status === 'pass' || status === 'na' ? '' : fix};
  }

  function meta(doc, key, value) {
    const wanted = value.toLowerCase();
    return [...doc.querySelectorAll('meta')].find(el => (el.getAttribute(key) || '').toLowerCase() === wanted) || null;
  }
  const metaContent = (doc, key, value) => trim(meta(doc, key, value)?.getAttribute('content'), 1000);

  // Visible-ish text of the body with script/style/noscript/template stripped.
  function bodyText(doc) {
    const body = doc.body?.cloneNode(true);
    if (!body) return '';
    for (const el of body.querySelectorAll('script, style, noscript, template, svg')) el.remove();
    return body.textContent || '';
  }
  function faxLabel(doc, node, offset = 0) {
    if (node.nodeType === 1 && /\bfax\b/i.test(node.textContent.slice(0, 20))) return true;
    if (!doc.createRange) return false;
    const anchor = node.nodeType === 3 ? node : node.firstChild || node;
    for (let parent = anchor.parentElement, depth = 0; parent && depth < 4; parent = parent.parentElement, depth++) {
      if (parent === doc.body && depth > 1) break;
      const range = doc.createRange();
      range.selectNodeContents(parent);
      if (node.nodeType === 3) range.setEnd(node, offset);
      else range.setEnd(anchor, 0);
      if (/\bfax\b[^\d]{0,20}$/i.test(range.toString().slice(-24))) return true;
      if (parent === doc.body) break;
    }
    return false;
  }

  // Every object in every JSON-LD block, @graph flattened, capped for pathological pages.
  function jsonLd(doc) {
    const out = [];
    let visited = 0;
    function visit(value) {
      if (++visited > 10000 || !value || typeof value !== 'object') return;
      if (Array.isArray(value)) { for (const item of value) visit(item); return; }
      out.push(value);
      for (const [key, item] of Object.entries(value)) if (key !== '@context') visit(item);
    }
    for (const script of doc.querySelectorAll('script[type="application/ld+json" i]')) {
      try { visit(JSON.parse(script.textContent)); } catch (_) { /* invalid JSON-LD is ignored */ }
    }
    return out;
  }
  const types = obj => (Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']]).filter(t => typeof t === 'string').map(t => t.split('/').pop());

  function absUrl(href, base) { try { return new URL(href, base); } catch (_) { return null; } }
  // Registrable-ish domain: last two labels, or three for common two-part TLDs.
  function siteDomain(hostname) {
    const parts = String(hostname || '').toLowerCase().replace(/^www\./, '').split('.');
    const two = /^(co|com|org|net|gov|ac)\.[a-z]{2}$/.test(parts.slice(-2).join('.'));
    return parts.slice(two ? -3 : -2).join('.');
  }

  // Score a list of checks: weighted pass=1, warn=.5, fail=0; na and weight 0 excluded. null when nothing scored.
  function score(checks) {
    const scored = checks.filter(c => c.status !== 'na' && c.weight);
    const total = scored.reduce((sum, c) => sum + c.weight, 0);
    if (!total) return null;
    return Math.round(scored.reduce((sum, c) => sum + c.weight * (c.status === 'pass' ? 1 : c.status === 'warn' ? .5 : 0), 0) / total * 100);
  }
  const grade = s => s == null ? '–' : s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F';

  root.SiteAuditorLib = {trim, check, meta, metaContent, bodyText, faxLabel, jsonLd, types, absUrl, siteDomain, score, grade};
  if (typeof module !== 'undefined') module.exports = root.SiteAuditorLib;
})(globalThis);
