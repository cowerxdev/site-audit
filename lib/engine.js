/* Runs inside the audited tab. Only same-origin page fetches are permitted. */
(function (root) {
  'use strict';
  const ORDER = [['seo', 'SEO'], ['local', 'Local'], ['conversion', 'Conversion'], ['perf', 'Performance'], ['a11y', 'Accessibility'], ['trust', 'Trust'], ['tech', 'Tech']];
  const WEIGHTS = {basics: 2, seo: 1.5, local: 1.5, conversion: 1.5, perf: 1, a11y: 1, trust: 1, tech: .5, vertical_law: 1, vertical_cpa: 1, vertical_trades: 1};
  function detectVertical(doc) {
    if (root.SiteAuditorClassifier) return root.SiteAuditorClassifier.classify(doc).type;
    const title = doc.title || '';
    const headings = [...doc.querySelectorAll('h1,h2,h3')].slice(0, 80).map(el => el.textContent || '').join(' ');
    const schema = root.SiteAuditorLib.jsonLd(doc).slice(0, 200).flatMap(root.SiteAuditorLib.types).join(' ');
    const patterns = {
      law: /\b(?:law\s*firms?|law\s*offices?|attorneys?|lawyers?|legal\s*(?:services?|counsel)|practice\s*areas?|litigation)\b/i,
      cpa: /\b(?:cpa|certified\s*public\s*accountants?|accounting|accountants?|bookkeeping|tax\s*(?:preparation|services?|advisory|planning))\b/i,
      trades: /\b(?:plumb(?:er|ing)?|electric(?:ian|al)?|hvac|heating|air\s*conditioning|roof(?:er|ing)?|contractor|home\s*repair)\b/i
    };
    const schemaTypes = {
      law: /\b(?:LegalService|Attorney)\b/i,
      cpa: /\bAccountingService\b/i,
      trades: /\b(?:Plumber|Electrician|HVACBusiness|RoofingContractor|GeneralContractor|HomeAndConstructionBusiness)\b/i
    };
    const scores = Object.keys(patterns).map(id => ({id, score: (patterns[id].test(title) ? 3 : 0) + (patterns[id].test(headings) ? 2 : 0) + (schemaTypes[id].test(schema) ? 4 : 0)}));
    scores.sort((a, b) => b.score - a.score);
    return scores[0].score >= 2 && scores[0].score > scores[1].score ? scores[0].id : null;
  }
  const BASIC_SENTENCES = {
    https: () => 'The site loads over plain HTTP, so Chrome labels it "Not secure" in the address bar.',
    viewport: () => 'There is no mobile viewport tag, so on a phone the page may show as a shrunken desktop layout.',
    portal: () => 'I could not find a client portal or login link on the homepage.',
    payment: () => 'I could not find an online payment link on the homepage.',
  };
  function overall(modules) {
    let sum = 0, weight = 0;
    for (const mod of modules || []) {
      if (mod?.score == null || !Number.isFinite(Number(mod.score))) continue;
      const w = WEIGHTS[mod.id] || (mod.id.startsWith('family_') || mod.id.startsWith('vertical_') ? 1 : 0);
      sum += Number(mod.score) * w; weight += w;
    }
    return weight ? Math.round(sum / weight) : null;
  }
  function counts(checks) {
    const out = {pass: 0, warn: 0, fail: 0, na: 0};
    for (const c of checks) if (Object.hasOwn(out, c.status)) out[c.status]++;
    return out;
  }
  function compact(value, depth = 0) {
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value.slice(0, 500);
    if (depth >= 5) return null;
    if (Array.isArray(value)) return value.slice(0, 30).map(v => compact(v, depth + 1));
    if (typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value).slice(0, 35)) out[key] = compact(value[key], depth + 1);
      return out;
    }
    return null;
  }
  function cleanChecks(checks) {
    return (Array.isArray(checks) ? checks : []).slice(0, 250).map(c => ({
      id: String(c.id || '').slice(0, 100), label: String(c.label || '').slice(0, 120),
      status: ['pass', 'warn', 'fail', 'na'].includes(c.status) ? c.status : 'na',
      weight: Math.min(3, Math.max(0, Number(c.weight) || 0)),
      evidence: String(c.evidence || '').slice(0, 400), fix: String(c.fix || '').slice(0, 400)
    }));
  }
  function wrap(id, label, checks, data = {}, error = null) {
    const safe = cleanChecks(checks);
    const score = error ? null : root.SiteAuditorLib.score(safe);
    return {id, label, score, grade: root.SiteAuditorLib.grade(score), counts: counts(safe), checks: safe, data: compact(data), error};
  }
  async function defaultFetch(path, maxBytes = 1_500_000) {
    try {
      const target = new URL(path, location.origin);
      if (target.origin !== location.origin) return null;
      const response = await fetch(target, {credentials: 'omit', redirect: 'follow', signal: AbortSignal.timeout(3000)});
      const contentType = response.headers.get('content-type') || '';
      if (new URL(response.url).origin !== location.origin) return {status: response.status, contentType, text: ''};
      const limit = Math.max(0, Math.min(1_500_000, Number(maxBytes) || 0));
      const reader = response.body?.getReader();
      if (!reader) return {status: response.status, contentType, text: (await response.text()).slice(0, limit)};
      const chunks = []; let size = 0;
      while (size < limit) {
        const {done, value} = await reader.read();
        if (done) break;
        const slice = value.subarray(0, limit - size); chunks.push(slice); size += slice.length;
      }
      await reader.cancel().catch(() => {});
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return {status: response.status, contentType, text: new TextDecoder().decode(bytes)};
    } catch (_) { return null; }
  }
  function descriptor(el) {
    if (!el?.tagName) return '';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : el.classList?.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''}`.slice(0, 80);
  }
  function collectPerf(win) {
    return new Promise(resolve => {
      const result = {lcp: null, cls: null}; const observers = [];
      let done = false;
      const finish = () => { if (done) return; done = true; observers.forEach(o => o.disconnect()); resolve(result); };
      const timer = setTimeout(finish, 250);
      try {
        const supported = win.PerformanceObserver?.supportedEntryTypes || [];
        if (supported.includes('largest-contentful-paint')) {
          const observer = new win.PerformanceObserver(list => {
            const entries = list.getEntries(); const last = entries[entries.length - 1];
            if (last) result.lcp = {ms: Math.round(last.startTime), element: descriptor(last.element), size: Math.round(last.size || 0)};
          });
          observer.observe({type: 'largest-contentful-paint', buffered: true}); observers.push(observer);
        }
        if (supported.includes('layout-shift')) {
          result.cls = 0;
          const observer = new win.PerformanceObserver(list => {
            for (const entry of list.getEntries()) if (!entry.hadRecentInput) result.cls += entry.value;
          });
          observer.observe({type: 'layout-shift', buffered: true}); observers.push(observer);
        }
      } catch (_) { /* unsupported observer types */ }
      if (!observers.length) { clearTimeout(timer); finish(); }
    });
  }
  async function runAll({doc, url, year, win, live = false, globals = {}, perf = null, fetchSameOrigin = defaultFetch, vertical = null, classification = null}) {
    const start = Date.now();
    const basics = root.SiteAuditorChecks.audit(doc, url, year);
    const basicChecks = basics.checks.map(c => {
      const fix = BASIC_SENTENCES[c.id]?.(c) || '';
      return {...c, id: `basics.${c.id}`, fix: ['fail', 'warn'].includes(c.status) ? fix : ''};
    });
    const modules = [wrap('basics', 'Essentials', basicChecks)];
    const inferred = classification || root.SiteAuditorClassifier?.classify(doc) || null;
    const manualFamily = vertical === 'general' || (vertical && root.SiteAuditorModules?.[`family_${vertical.replaceAll('-', '_')}`]) ? vertical : null;
    const overrideFamily = !manualFamily && vertical && (root.SiteAuditorVerticalModel?.type_hints?.[vertical]?.family ||
      Object.values(root.SiteAuditorSchemaTypes?.types || {}).find(entry => entry.checks === `vertical_${vertical}`)?.family);
    const family = manualFamily || overrideFamily || inferred?.family || 'general';
    const type = manualFamily ? (manualFamily === inferred?.family ? inferred.type : null) :
      vertical || inferred?.type || (inferred ? null : detectVertical(doc));
    const detectedVertical = type;
    const ctx = {doc, url, host: basics.host, year, win, live, globals, perf, fetchSameOrigin,
      vertical: detectedVertical, family, type};
    // Modules run concurrently; SEO gets a longer budget because it makes up to 4 same-origin fetches.
    const settled = await Promise.all(ORDER.map(async ([id, label]) => {
      const mod = root.SiteAuditorModules?.[id];
      if (!mod?.run) return null;
      const limit = id === 'seo' ? 9000 : 4000;
      let timeout;
      try {
        const output = await Promise.race([
          Promise.resolve().then(() => mod.run(ctx)),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`Timed out after ${limit / 1000} seconds`)), limit); })
        ]);
        return wrap(id, label, output?.checks, output?.data);
      } catch (err) { return wrap(id, label, [], {}, String(err?.message || err).slice(0, 200)); }
      finally { clearTimeout(timeout); }
    }));
    for (const mod of settled) if (mod) modules.push(mod);
    const familyId = family !== 'general' && `family_${family.replaceAll('-', '_')}`;
    const familyMod = familyId && root.SiteAuditorModules?.[familyId];
    if (familyMod?.run) {
      try {
        const output = await familyMod.run(doc, ctx);
        modules.push(wrap(familyId, familyMod.label, output?.checks, output?.data));
      } catch (err) { modules.push(wrap(familyId, familyMod.label, [], {}, String(err?.message || err).slice(0, 200))); }
    }
    const verticalId = manualFamily && manualFamily !== inferred?.family ? null :
      !manualFamily && vertical ? `vertical_${vertical}` :
      inferred?.checks || (detectedVertical && `vertical_${detectedVertical}`);
    const verticalMod = verticalId && root.SiteAuditorModules?.[verticalId];
    if (verticalMod?.run) {
      try {
        const output = await verticalMod.run(doc, ctx);
        modules.push(wrap(verticalId, verticalMod.label, output?.checks, output?.data));
      } catch (err) { modules.push(wrap(verticalId, verticalMod.label, [], {}, String(err?.message || err).slice(0, 200))); }
    }
    const score = overall(modules);
    const result = {version: '1.2.1', url, host: basics.host, title: basics.meta?.title || '',
      family, type, vertical: detectedVertical, auditedAt: new Date().toISOString(), score,
      grade: root.SiteAuditorLib.grade(score), stack: compact(basics.stack), modules, durationMs: Date.now() - start};
    // Data is optional. Preserve all check evidence, reducing data if a page is unusually large.
    const bytes = () => new TextEncoder().encode(JSON.stringify(result)).length;
    if (bytes() > 190000) for (const mod of modules) mod.data = {};
    while (bytes() > 190000) {
      const largest = modules.reduce((best, mod) => mod.checks.length > (best?.checks.length || 0) ? mod : best, null);
      if (!largest?.checks.length) break;
      largest.checks.pop();
      largest.counts = counts(largest.checks);
    }
    if (bytes() > 190000) result.url = result.url.slice(0, 4096);
    return result;
  }
  root.SiteAuditorEngine = {runAll, overall, defaultFetch, collectPerf, detectVertical};
  if (typeof module !== 'undefined') module.exports = root.SiteAuditorEngine;
})(globalThis);
