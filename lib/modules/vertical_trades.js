(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const c = (id, label, weight, status, evidence, fix) => L.check(`vertical_trades.${id}`, label, weight, status, evidence, fix);
  const short = value => L.trim(value, 120);
  function run(doc, ctx) {
    if (!ctx) { ctx = doc; doc = ctx.doc; }
    const text = L.bodyText(doc).slice(0, 300000);
    const links = [...doc.querySelectorAll('a[href]')].slice(0, 2000);
    const emergency = /(?:24\s*\/\s*7|24[\s-]*hour|after[\s-]*hours?|emergency (?:service|repair|plumb|electric|hvac)|same[\s-]*day (?:service|repair))/i.exec(text);
    const area = /(?:service areas?|areas? we serve|serving (?:the|all of|greater)|communities we serve)[\s:–-]*([^.!?\n]{0,180})/i.exec(text);
    const areaLink = links.find(a => /service[\s-]*areas?|areas?[-_/]we[-_/]serve|locations? we serve/i.test(`${a.textContent} ${a.getAttribute('href')}`));
    const areaList = area && /\b[A-Za-z][A-Za-z .'-]+\s*,\s*[A-Za-z][A-Za-z .'-]+/.test(area[1]);
    const tel = links.filter(a => /^tel:/i.test(a.getAttribute('href') || '') && !L.faxLabel(doc, a));
    const height = Number(ctx.win?.innerHeight) || 768;
    const above = tel.find(a => {
      const rect = a.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0 || rect.top >= height || rect.bottom <= 0) return false;
      for (let node = a; node?.nodeType === 1; node = node.parentElement) {
        const style = ctx.win.getComputedStyle(node);
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
      }
      return true;
    });
    return {checks: [
      c('after_hours', 'Emergency or after hours wording', 2, emergency ? 'pass' : 'warn', emergency ? short(emergency[0]) : 'No emergency or after hours wording found', 'State whether emergency or after hours service is available.'),
      c('service_area', 'Service area list', 2, areaLink || areaList ? 'pass' : area ? 'warn' : 'fail', areaLink ? short(areaLink.textContent || areaLink.getAttribute('href')) : area ? short(area[0]) : 'No service area list or page found', 'List the towns or neighborhoods served and link to a service area page.'),
      c('tap_to_call_above_fold', 'Tap to call above the fold', 2, above ? 'pass' : tel.length ? 'warn' : 'fail', above ? short(above.textContent || above.getAttribute('href')) : tel.length ? 'Phone link appears below the first screen' : 'No tap-to-call link found', 'Put a visible tap-to-call phone link near the top of the mobile page.')
    ], data: {}};
  }
  M.vertical_trades = {id: 'vertical_trades', label: 'Trades', run};
})(globalThis);
