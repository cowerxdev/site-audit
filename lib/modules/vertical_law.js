(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const c = (id, label, weight, status, evidence, fix) => L.check(`vertical_law.${id}`, label, weight, status, evidence, fix);
  const short = value => L.trim(value, 110);
  function run(doc, ctx) {
    if (!ctx) { ctx = doc; doc = ctx.doc; }
    const text = L.bodyText(doc).slice(0, 300000);
    const links = [...doc.querySelectorAll('a[href]')].slice(0, 2000);
    const find = re => links.find(a => re.test(`${a.textContent || ''} ${a.getAttribute('href') || ''}`));
    const linkEvidence = a => a ? short(a.textContent || a.getAttribute('href')) : 'No matching page link found';
    const practice = find(/practice[\s-]*areas?|areas?[\s-]*of[\s-]*practice|\/practice[-_/]|\/services\//i);
    const bio = find(/attorneys?|lawyers?|our[\s-]*team|our[\s-]*people|\/bio(?:graphy|s)?[\/-]|\/attorney[\/-]/i);
    const disclaimer = /attorney advertising|lawyer advertising|not legal advice|does not (?:create|establish|constitute) an attorney[\s-]*client relationship|prior results do not guarantee|past results do not guarantee/i.exec(text);
    const disclaimerLink = find(/advertising[\s-]*disclaimer|legal[\s-]*disclaimer|\/disclaimer/i);
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
      c('practice_areas', 'Practice area pages', 2, practice ? 'pass' : /practice areas?/i.test(text) ? 'warn' : 'fail', practice ? linkEvidence(practice) : 'No practice area page link found', 'Link to separate practice area pages so visitors can find the help they need.'),
      c('attorney_bios', 'Attorney bios', 2, bio ? 'pass' : /\battorneys?\b/i.test(text) ? 'warn' : 'fail', bio ? linkEvidence(bio) : 'No attorney bio page link found', 'Add attorney biography pages and link to them from the homepage.'),
      c('advertising_disclaimer', 'Advertising disclaimer', 2, disclaimer || disclaimerLink ? 'pass' : 'fail', disclaimer ? short(disclaimer[0]) : disclaimerLink ? linkEvidence(disclaimerLink) : 'No advertising or legal disclaimer found', 'Add an attorney advertising and legal information disclaimer appropriate for the firm.'),
      c('tap_to_call_above_fold', 'Tap to call above the fold', 2, above ? 'pass' : tel.length ? 'warn' : 'fail', above ? `${linkEvidence(above)} near top of page` : tel.length ? 'Phone link appears below the first screen' : 'No tap-to-call link found', 'Put a visible tap-to-call phone link near the top of the mobile page.')
    ], data: {}};
  }
  M.vertical_law = {id: 'vertical_law', label: 'Law', run};
})(globalThis);
