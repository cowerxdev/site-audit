/* Local two-level page classification; no network or dynamic code. */
(function (root) {
  'use strict';
  const schemaTable = () => root.SiteAuditorSchemaTypes?.types ||
    (typeof module !== 'undefined' ? require('./data/schema_types.json').types : {});
  function pageText(doc) {
    const all = selector => [...doc.querySelectorAll(selector)].map(el => el.innerText || el.textContent || '').join(' ');
    const title = doc.title || '';
    const headings = all('h1,h2,h3');
    const nav = all('nav');
    const body = (doc.body?.innerText || doc.body?.textContent || '').slice(0, 3000);
    const words = value => (value.toLowerCase().match(/[a-z0-9]+/g) || []);
    const prominent = [...words(title).slice(0, 60).map(word => 'tt' + word),
      ...words(headings).slice(0, 120).map(word => 'hh' + word)];
    return {title, headings, nav, body, text: [title, headings, nav, body, ...prominent].join(' ')};
  }
  function hash(word) {
    let value = 2166136261;
    for (let i = 0; i < word.length; i++) value = Math.imul(value ^ word.charCodeAt(i), 16777619) >>> 0;
    return value & 16383;
  }
  function features(text) {
    const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
    const found = new Set();
    for (let i = 0; i < words.length; i++) {
      found.add(hash(words[i]));
      if (i) found.add(hash(words[i - 1] + '_' + words[i]));
    }
    return found;
  }
  function probabilities(text, head) {
    if (!head?.weights || !head?.labels) return null;
    const fs = features(text);
    const logits = head.weights.map((weights, i) => {
      let score = head.intercepts[i];
      for (const feature of fs) score += weights[feature] || 0;
      return score;
    });
    const max = Math.max(...logits);
    const exp = logits.map(score => Math.exp(score - max));
    const total = exp.reduce((sum, value) => sum + value, 0);
    return Object.fromEntries(head.labels.map((label, i) => [label, exp[i] / total]));
  }
  function schemaNames(doc) {
    const names = [];
    const visit = (value, depth = 0) => {
      if (!value || depth > 8) return;
      if (Array.isArray(value)) { for (const item of value.slice(0, 100)) visit(item, depth + 1); return; }
      if (typeof value !== 'object') return;
      const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
      for (const type of types) if (typeof type === 'string') names.push(type);
      for (const [key, child] of Object.entries(value)) if (key !== '@type' && typeof child === 'object') visit(child, depth + 1);
    };
    for (const script of [...doc.querySelectorAll('script[type="application/ld+json" i]')].slice(0, 20)) {
      try { visit(JSON.parse((script.textContent || '').slice(0, 100000))); } catch (_) { /* invalid JSON-LD */ }
    }
    for (const el of [...doc.querySelectorAll('[itemtype]')].slice(0, 50)) {
      for (const type of (el.getAttribute?.('itemtype') || '').split(/\s+/)) names.push(type);
    }
    return names.map(name => name.split('/').pop().split('#').pop().replace(/^schema:/, ''));
  }
  function fromSchema(doc) {
    const table = schemaTable();
    const hits = schemaNames(doc).map(name => table[name]).filter(entry => entry?.family);
    const families = new Set(hits.map(hit => hit.family));
    if (families.size !== 1) return null;
    const typed = hits.filter(hit => hit.type);
    return typed.sort((a, b) => b.type.length - a.type.length)[0] || hits[0];
  }
  function typeHint(page, family, model) {
    const prominent = [page.title, page.headings.slice(0, 500), page.nav.slice(0, 300)].join(' ');
    const hits = Object.entries(model?.type_hints || {}).filter(([, hint]) =>
      (family === 'general' || hint.family === family) && new RegExp(hint.pattern, 'i').test(prominent));
    if (hits.length !== 1) return null;
    const [type, hint] = hits[0];
    return {type, family: hint.family, checks: hint.checks || null, inTitle: new RegExp(hint.pattern, 'i').test(page.title)};
  }
  function classify(doc, model = root.SiteAuditorVerticalModel) {
    const page = pageText(doc);
    const schema = fromSchema(doc);
    const probs = probabilities(page.text, model?.family_model);
    let family, p, source;
    if (schema) {
      family = schema.family; p = .99; source = 'schema';
    } else if (probs) {
      const [winner, confidence] = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
      family = winner === 'other' || confidence < (model.floor ?? .8) ? 'general' : winner;
      p = confidence; source = family === 'general' ? 'floor' : 'model';
    } else {
      family = 'general'; p = 0; source = 'floor';
    }
    let type = schema?.type || null;
    let checks = schema?.checks || null;
    // A single unambiguous type word in the title, headings or navigation picks the type.
    const hint = type ? null : typeHint(page, family, model);
    // Only the page title may name a family the model did not: headlines on news sites say "attorney" too.
    if (hint && family === 'general') { if (hint.inTitle) { family = hint.family; source = 'hint'; } }
    if (!type && family !== 'general') {
      if (hint) { type = hint.type; checks = hint.checks; }
      else if (model?.type_model) {
        const typed = probabilities(page.text, model.type_model);
        const [winner, confidence] = Object.entries(typed).sort((a, b) => b[1] - a[1])[0];
        if (confidence >= (model.type_floor ?? .82) && model.type_families[winner] === family) {
          type = winner; checks = model.type_hints?.[winner]?.checks || null;
        }
      }
    }
    return {family, type, label: family, p, source, checks};
  }
  root.SiteAuditorClassifier = {classify, pageText, hash, features, probabilities, schemaNames, fromSchema};
  if (typeof module !== 'undefined') module.exports = root.SiteAuditorClassifier;
})(globalThis);
