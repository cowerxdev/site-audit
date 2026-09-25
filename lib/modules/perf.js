(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const bytes = n => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0;
  const size = n => n >= 1000000 ? `${(n / 1000000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;
  const name = url => { try { return decodeURIComponent(new URL(url, 'https://example.test').pathname.split('/').pop()) || url; } catch (_) { return String(url || 'unknown').split('/').pop(); } };
  const status = (n, pass, warn) => n <= pass ? 'pass' : n <= warn ? 'warn' : 'fail';
  const check = (id, label, weight, state, evidence, fix) => L.check(`perf.${id}`, label, weight, state, evidence, fix);
  function analyze(input) {
    const live = !!input.live;
    const resources = input.resources || [];
    const navigation = input.navigation;
    const images = input.images || [];
    const blocking = input.blocking || [];
    const checks = [];
    const all = navigation ? [navigation, ...resources] : resources;
    const total = all.reduce((sum, r) => sum + (bytes(r.transferSize) || bytes(r.encodedBodySize)), 0);
    const hidden = resources.filter(r => { try { return !bytes(r.transferSize) && !bytes(r.encodedBodySize) && /^https?:/i.test(r.name || '') && L.siteDomain(new URL(r.name).hostname) !== L.siteDomain(input.host); } catch (_) { return false; } }).length;
    checks.push(check('weight', 'Page transfer size', 2, live ? (total < 1.5e6 ? 'pass' : total <= 4e6 ? 'warn' : 'fail') : 'na', live ? `${size(total)} across ${resources.length + (navigation ? 1 : 0)} requests${hidden ? `; ${hidden} resources size-hidden by cross-origin` : ''}` : 'Needs a live page', `The homepage downloads ${size(total)} across ${resources.length + (navigation ? 1 : 0)} requests, so visitors wait for a large amount of page data.`));
    checks.push(check('requests', 'Network requests', 1, live ? (resources.length < 80 ? 'pass' : resources.length <= 150 ? 'warn' : 'fail') : 'na', live ? `${resources.length} resource requests` : 'Needs a live page', `The homepage makes ${resources.length} separate file requests, which can delay its first display.`));
    const biggest = [...images].sort((a, b) => (bytes(b.bytes) || bytes(b.naturalWidth) * bytes(b.naturalHeight)) - (bytes(a.bytes) || bytes(a.naturalWidth) * bytes(a.naturalHeight))).slice(0, 5);
    const flagged = biggest.filter(i => (bytes(i.naturalWidth) > 1000 && bytes(i.naturalWidth) * bytes(i.naturalHeight) > 4 * bytes(i.renderedWidth) * bytes(i.renderedHeight) && bytes(i.renderedWidth) * bytes(i.renderedHeight) > 0) || bytes(i.bytes) > 500000);
    const worst = flagged[0];
    checks.push(check('images', 'Oversized images', 2, flagged.length === 0 ? 'pass' : flagged.length <= 2 ? 'warn' : 'fail', worst ? `${flagged.length} of ${biggest.length} largest images oversized; ${name(worst.src)} ${worst.naturalWidth}x${worst.naturalHeight} shown at ${Math.round(worst.renderedWidth)}x${Math.round(worst.renderedHeight)} (${size(bytes(worst.bytes))})` : `No oversized images among ${biggest.length} largest images`, `The image ${L.trim(name(worst?.src), 50)} is ${worst?.naturalWidth}×${worst?.naturalHeight} pixels but shown at ${Math.round(worst?.renderedWidth)}×${Math.round(worst?.renderedHeight)}${bytes(worst?.bytes) ? ` (${size(bytes(worst.bytes))})` : ''}, so visitors download detail the page does not display.`));
    const lcp = input.lcp;
    checks.push(check('lcp', 'Largest contentful paint', 2, !live || lcp == null || !Number.isFinite(Number(lcp.ms)) ? 'na' : status(Number(lcp.ms), 2500, 4000), !live ? 'Needs a live page' : lcp == null ? 'LCP not reported by this browser/page yet' : `${Math.round(lcp.ms)} ms${lcp.element ? `; ${lcp.element}` : ''}`, `The largest visible part of the homepage takes ${(Number(lcp?.ms) / 1000).toFixed(1)} seconds to appear, so visitors see it later than the rest of the page.`));
    const cls = input.cls;
    checks.push(check('cls', 'Cumulative layout shift', 2, !live || cls == null || !Number.isFinite(Number(cls)) ? 'na' : status(Number(cls), 0.1, 0.25), !live ? 'Needs a live page' : cls == null ? 'CLS not reported by this browser/page yet' : `CLS ${Number(cls).toFixed(3)}`, `The homepage's layout shifts as it loads (shift score ${Number(cls).toFixed(3)}), so text or buttons can move while visitors try to use them.`));
    const block = new Map();
    for (const b of blocking) block.set(`${b.type}:${b.src}`, b);
    if (live) for (const r of resources) if (r.renderBlockingStatus === 'blocking') block.set(`${r.initiatorType === 'script' ? 'script' : 'stylesheet'}:${r.name}`, {type: r.initiatorType, src: r.name});
    const blockList = [...block.values()];
    checks.push(check('render_blocking', 'Render blocking files', 1, !live && !blockList.length ? 'na' : status(blockList.length, 2, 6), blockList.length ? `${blockList.length} blocking scripts/stylesheets: ${blockList.slice(0, 3).map(b => name(b.src)).join(', ')}${live ? '' : ' (DOM only)'}` : live ? '0 render blocking files' : 'Needs a live page', `The homepage waits on ${blockList.length} script or style files before it can draw, including ${L.trim(name(blockList[0]?.src), 50)}.`));
    const counts = new Map();
    const own = L.siteDomain(input.host);
    const timedScripts = live ? resources.filter(r => r.initiatorType === 'script').map(r => r.name) : [];
    const timedUrls = new Set(timedScripts);
    const scripts = [...timedScripts, ...(input.scriptSrcs || []).filter(src => !timedUrls.has(src))];
    for (const src of scripts) { try { const domain = L.siteDomain(new URL(src).hostname); if (domain && domain !== own) counts.set(domain, (counts.get(domain) || 0) + 1); } catch (_) { /* malformed URL */ } }
    const thirdParty = [...counts].map(([domain, count]) => ({domain, count})).sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
    checks.push(check('third_party', 'Third party script domains', 1, !live && !scripts.length ? 'na' : status(thirdParty.length, 8, 15), thirdParty.length ? `${thirdParty.length} domains: ${thirdParty.slice(0, 3).map(d => d.domain).join(', ')}${live ? '' : ' (DOM only)'}` : live ? '0 third party script domains' : 'Needs a live page', `The homepage loads scripts from ${thirdParty.length} outside domains, so its display depends on those other sites responding.`));
    return {checks, data: {images: biggest, blocking: blockList, thirdParty, totalBytes: total, hiddenSizeCount: hidden, requestCount: resources.length}};
  }
  function collect(ctx) {
    const doc = ctx.doc;
    const win = ctx.win;
    const entries = type => { try { return [...win.performance.getEntriesByType(type)].slice(0, 2000); } catch (_) { return []; } };
    const resources = ctx.live ? entries('resource').map(e => ({name: e.name, initiatorType: e.initiatorType, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize, decodedBodySize: e.decodedBodySize, renderBlockingStatus: e.renderBlockingStatus, duration: e.duration})) : [];
    const navigation = ctx.live ? entries('navigation')[0] || null : null;
    const byUrl = new Map(resources.map(e => [e.name, e]));
    const images = [...doc.images].slice(0, 400).map(el => { const rect = el.getBoundingClientRect(); const src = el.currentSrc || el.src; return {src, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, renderedWidth: rect.width, renderedHeight: rect.height, bytes: byUrl.get(src)?.transferSize || byUrl.get(src)?.encodedBodySize || 0}; });
    const blocking = [];
    for (const el of [...doc.head?.querySelectorAll('script[src],link[rel~="stylesheet"][href]') || []].slice(0, 400)) {
      if (el.localName === 'script' && (el.async || el.defer || el.type === 'module')) continue;
      if (el.localName === 'link' && el.media && !win.matchMedia(el.media).matches) continue;
      blocking.push({type: el.localName === 'script' ? 'script' : 'stylesheet', src: el.src || el.href});
    }
    const scriptSrcs = [...doc.querySelectorAll('script[src]')].slice(0, 400).map(el => el.src);
    return {live: ctx.live, host: ctx.host, resources, navigation, images, blocking, scriptSrcs, lcp: ctx.perf?.lcp ?? null, cls: ctx.perf?.cls ?? null};
  }
  M.perf = {id: 'perf', label: 'Performance', analyze, collect, run: async ctx => { try { return analyze(collect(ctx)); } catch (err) { return {checks: [check('unavailable', 'Performance', 0, 'na', `Could not measure performance: ${err.message}`, '')], data: {}}; } }};
})(globalThis);
