(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const check = (id, label, weight, status, evidence, fix) => L.check(`trust.${id}`, label, weight, status, evidence, fix);
  const AWARDS = [['Super Lawyers', /super\s*lawyers/i], ['Best Lawyers', /best\s*lawyers/i], ['Avvo', /avvo/i], ['Martindale-Hubbell AV', /martindale[-\s]*hubbell|av[-\s]?preeminent/i], ['Rising Stars', /rising stars?/i], ['BBB A+', /bbb\s*a\+|better business bureau\s*a\+/i], ['Angi Super Service', /angi(?:e)?\s*super service/i], ['HomeAdvisor Top Rated', /homeadvisor\s*top rated/i], ['Best of Houzz', /best of houzz/i], ['Expertise.com', /expertise\.com/i], ['Nextdoor Fave', /nextdoor\s*fav(?:e|orite)/i], ['Inc 5000', /inc\.?\s*5000/i]];
  const datePatterns = [/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)\s+\d{1,2},?\s+\d{4}\b/gi, /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, /\b\d{4}-\d{2}-\d{2}\b/g];
  function run(ctx) {
    try {
      const doc = ctx.doc, year = Number(ctx.year) || new Date().getFullYear(), body = L.bodyText(doc).slice(0, 300000), checks = [];
      let best = null;
      for (const m of body.matchAll(/(?:©|&copy;|copyright)[^\d]{0,40}((?:19|20)\d{2})(?:\s*[-–—]\s*((?:19|20)\d{2}))?/gi)) {
        const y = Math.max(Number(m[1]), Number(m[2]) || 0); if (y <= year + 1 && (!best || y > best.year)) best = {year: y, text: L.trim(m[0], 80)};
      }
      checks.push(check('copyright', 'Copyright year', 2, !best ? 'na' : best.year >= year - 1 ? 'pass' : best.year >= year - 4 ? 'warn' : 'fail', best?.text || 'No copyright year found', `The homepage still shows a ${best?.year} copyright year, so visitors may wonder whether the site is current.`));
      const links = [...doc.querySelectorAll('a[href]')].slice(0, 2000);
      const link = re => links.find(a => re.test(`${a.textContent} ${a.getAttribute('href')}`));
      const privacy = link(/privacy/i), terms = link(/terms(?:\s+of\s+(?:use|service)|\s+and\s+conditions)?|disclaimer|\blegal\b/i), access = link(/accessibility/i);
      const visible = el => {
        if (!el.getClientRects().length) return false;
        for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
          const style = ctx.win.getComputedStyle(node);
          if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
        }
        return true;
      };
      const collectsData = [...doc.querySelectorAll('form')].slice(0, 200).some(form => {
        if (!visible(form)) return false;
        return [...form.querySelectorAll('input,select,textarea')].slice(0, 100).some(field => {
          return !['hidden', 'submit', 'button', 'reset', 'image'].includes((field.type || '').toLowerCase()) &&
            !field.disabled && !field.readOnly && visible(field);
        });
      });
      checks.push(check('privacy', 'Privacy policy', 2, privacy ? 'pass' : collectsData ? 'fail' : 'warn', privacy ? L.trim(privacy.textContent || privacy.getAttribute('href'), 80) : 'No privacy policy link', collectsData ? 'The homepage collects form details but has no privacy policy link, so visitors cannot see how that information is handled.' : 'The homepage has no privacy policy link, so visitors cannot see how their information would be handled.'));
      checks.push(check('terms', 'Terms or legal notice', 1, terms ? 'pass' : 'warn', terms ? L.trim(terms.textContent || terms.getAttribute('href'), 80) : 'No terms or legal link found', 'The homepage has no terms or legal notice link, so visitors cannot find the site’s stated terms.'));
      checks.push(check('a11y_statement', 'Accessibility statement', 1, access ? 'pass' : 'warn', access ? L.trim(access.textContent || access.getAttribute('href'), 80) : 'No accessibility statement link found', 'The homepage has no accessibility statement link, so visitors cannot find guidance about using the site with assistive tools.'));
      const found = []; const today = new Date(); const limit = new Date(today.getTime() + 86400000);
      const addDate = (raw, where) => { const date = new Date(raw); if (!Number.isNaN(date.getTime()) && date >= new Date('1995-01-01') && date <= limit) found.push({date, raw: L.trim(raw, 40), where}); };
      for (const el of [...doc.querySelectorAll('time[datetime]')].slice(0, 100)) addDate(el.getAttribute('datetime'), '<time>');
      for (const obj of L.jsonLd(doc).slice(0, 500)) for (const key of ['datePublished', 'dateModified']) if (typeof obj[key] === 'string') addDate(obj[key], `JSON-LD ${key}`);
      for (const key of ['article:modified_time', 'og:updated_time']) { const value = L.metaContent(doc, 'property', key); if (value) addDate(value, `meta ${key}`); }
      for (const re of datePatterns) { let n = 0; for (const m of body.matchAll(re)) { addDate(m[0], 'page text'); if (++n >= 100) break; } }
      found.sort((a, b) => b.date - a.date); const recent = found[0];
      const age = recent ? (today - recent.date) / 86400000 : Infinity;
      checks.push(check('recent_date', 'Recent page date', 1, !recent ? 'na' : age <= 183 ? 'pass' : age <= 548 ? 'warn' : 'fail', recent ? `${recent.date.toISOString().slice(0, 10)} from ${recent.where} ('${recent.raw}')` : 'No dated content found', `The newest dated content on the homepage is from ${recent?.date.toISOString().slice(0, 10)}, so visitors may wonder whether its information is current.`));
      const testimonial = /testimonials?|what our clients say|client reviews?|customer reviews?/i.test(body) || !!doc.querySelector('[class*="review" i],[id*="review" i],[class*="testimonial" i],[id*="testimonial" i],[itemprop="ratingValue"],.star-rating') || [...doc.querySelectorAll('blockquote')].slice(0, 100).some(el => !!el.querySelector('cite,footer') || /[—–]\s*\w+/.test(el.textContent)) || L.jsonLd(doc).some(o => L.types(o).some(t => /^(Review|AggregateRating)$/i.test(t)) || o.aggregateRating);
      checks.push(check('testimonials', 'Testimonials or reviews', 1, testimonial ? 'pass' : 'warn', testimonial ? 'Review or testimonial signal found' : 'No review or testimonial signal found', 'The homepage shows no client reviews or testimonials, so visitors cannot read customer experiences there.'));
      const awardText = [body.slice(0, 100000), ...[...doc.querySelectorAll('img,a,[class*="award" i],[class*="badge" i]')].slice(0, 1000).map(el => [el.getAttribute('alt'), el.getAttribute('title'), el.getAttribute('aria-label'), el.getAttribute('href'), el.getAttribute('src'), el.className].filter(x => typeof x === 'string').join(' '))].join(' ');
      const awards = AWARDS.filter(([, re]) => re.test(awardText)).map(([name]) => name);
      if (/\baward(?:ed|s)?\b/i.test(awardText) && !awards.length) awards.push('Award mention');
      checks.push(check('awards', 'Awards and badges', 0, awards.length ? 'pass' : 'na', awards.length ? awards.slice(0, 6).join(', ') : 'No award or badge signal found', ''));
      return {checks, data: {recentDate: recent?.date.toISOString().slice(0, 10) || null, awards}};
    } catch (err) { return {checks: [check('unavailable', 'Trust', 0, 'na', `Could not inspect trust signals: ${err.message}`, '')], data: {}}; }
  }
  M.trust = {id: 'trust', label: 'Trust', run: async ctx => run(ctx)};
})(globalThis);
