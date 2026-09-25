(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const specs = [
    ['cta_above_fold', 'Call to action above the fold', 3], ['forms', 'Contact forms', 2],
    ['chat', 'Chat widget', 0], ['booking', 'Online booking', 2], ['reviews', 'Review signals', 1],
    ['contact_channels', 'Contact channels', 0]
  ];
  function c(name, status, evidence, fix = '') {
    const [, label, weight] = specs.find(item => item[0] === name);
    return L.check(`conversion.${name}`, label, weight, status, evidence, fix);
  }
  const short = (v, max = 120) => L.trim(v, max);
  const cta = /\b(?:call|book|schedule|request|contact\s+us|get\s+started|start|apply|buy|order|reserve|sign\s+up|text\s+us|message\s+us|free\s+consult(?:ation)?|get\s+(?:a\s+)?(?:quote|estimate))\b/i;
  const bookingText = /\b(?:book|schedule|appointment|reservation|reserve|consultation)\b/i;
  function visible(el, win) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    for (let node = el, depth = 0; node && node.nodeType === 1 && depth < 12; node = node.parentElement, depth++) {
      const style = win.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) <= 0) return false;
    }
    return true;
  }
  function signatures(doc) {
    const list = [];
    for (const el of [...doc.querySelectorAll('script[src], iframe[src], a[href], img[src], [id], [class]')].slice(0, 2000)) {
      const value = [el.getAttribute('src'), el.getAttribute('href'), el.id, el.className?.baseVal || el.className].filter(x => typeof x === 'string' && x).join(' ');
      if (value) list.push(short(value, 300));
    }
    return list;
  }
  function matchTable(signals, table) {
    const found = [];
    for (const [name, pattern] of table || []) {
      const match = signals.find(value => pattern.test(value));
      if (match) found.push({name, source: match});
    }
    return found;
  }
  function run(ctx) {
    try {
      const doc = ctx.doc, win = ctx.win;
      const checks = [];
      const data = {viewport: {w: win.innerWidth, h: win.innerHeight}};
      const actions = [];
      for (const el of [...doc.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]')].slice(0, 1000)) {
        const text = short(el.value || el.getAttribute('aria-label') || el.textContent, 80);
        const tel = /^tel:/i.test(el.getAttribute('href') || '');
        if (tel && L.faxLabel(doc, el)) continue;
        if (!cta.test(text) && !tel) continue;
        if (!visible(el, win)) continue;
        const y = Math.round(el.getBoundingClientRect().top);
        if (y >= win.innerHeight || el.getBoundingClientRect().bottom <= 0) continue;
        actions.push({text: text || short(el.getAttribute('href'), 70), y, nav: Boolean(el.closest('nav,header'))});
      }
      actions.sort((a, b) => Number(a.nav) - Number(b.nav) || a.y - b.y);
      checks.push(c('cta_above_fold', actions.length ? 'pass' : 'fail', actions.length ? actions.slice(0, 3).map(x => `“${x.text}” at y=${x.y}px`).join('; ') : `No visible CTA in ${win.innerHeight}px viewport`, `The homepage shows no call, booking, or contact action in the first ${win.innerHeight}px of the screen, so visitors have to search for a way to respond.`));
      const forms = [];
      for (const form of [...doc.querySelectorAll('form')].slice(0, 200)) {
        if (!visible(form, win)) continue;
        const fields = [...form.querySelectorAll('input,select,textarea')].slice(0, 100).filter(el =>
          !['hidden', 'submit', 'button', 'reset', 'image'].includes((el.type || '').toLowerCase()) && visible(el, win));
        if (fields.length) forms.push(fields.length);
      }
      const embeddedForm = [...doc.querySelectorAll('iframe[src]')].slice(0, 200).find(el =>
        /form|jotform|typeform|wufoo|hubspot|cognito|formstack|google\.com\/forms/i.test(el.getAttribute('src') || '') && visible(el, win));
      const long = forms.some(n => n > 8);
      const formCheck = c('forms', !forms.length && !embeddedForm ? 'fail' : long ? 'warn' : 'pass', forms.length ? `${forms.length} ${forms.length === 1 ? 'form' : 'forms'} · ${forms.join(' and ')} fields${long ? ' · long form' : ''}` : embeddedForm ? `Embedded form: ${short(embeddedForm.getAttribute('src'), 100)}` : 'No visible form with a user-fillable field', !forms.length && !embeddedForm ? 'The homepage has no visible contact form, so visitors cannot send a message through the page.' : long ? `A homepage form asks for ${Math.max(...forms)} fields, so visitors face a long request before they can send it.` : '');
      checks.push(formCheck);
      const signals = signatures(doc);
      const table = root.SiteAuditorSignatures || {chat: [], booking: [], reviews: []};
      const chat = matchTable(signals, table.chat);
      checks.push(c('chat', chat.length ? 'pass' : 'na', chat.length ? chat.map(x => x.name).join(', ') : 'No chat widget signature found'));
      const booking = matchTable(signals, table.booking);
      const genericBooking = [...doc.querySelectorAll('a[href]')].slice(0, 1000).find(el => bookingText.test(short(el.textContent || el.getAttribute('aria-label'), 100)));
      checks.push(c('booking', booking.length ? 'pass' : genericBooking ? 'warn' : 'fail', booking.length ? booking.slice(0, 3).map(x => `${x.name}: ${short(x.source, 90)}`).join('; ') : genericBooking ? `Booking by form/phone: ${short(genericBooking.textContent, 70)} (${short(genericBooking.getAttribute('href'), 80)})` : 'No booking tool or booking link found', booking.length ? '' : genericBooking ? `The homepage's ${short(genericBooking.textContent || 'booking', 35)} link does not lead to an online scheduler, so visitors cannot choose an appointment time there.` : 'The homepage has no booking link or scheduling tool, so visitors cannot choose an appointment time there.'));
      const reviews = matchTable(signals, table.reviews).map(x => x.name);
      if (L.jsonLd(doc).slice(0, 300).some(obj => obj.aggregateRating || obj.review)) reviews.push('JSON-LD reviews');
      checks.push(c('reviews', reviews.length ? 'pass' : 'warn', reviews.length ? [...new Set(reviews)].join(', ') : 'No review widget, badge, or JSON-LD review found', 'The homepage shows no linked reviews or review badge, so visitors cannot check customer feedback from the page.'));
      const channels = [];
      if ([...doc.querySelectorAll('a[href^="tel:" i]')].some(el => !L.faxLabel(doc, el))) channels.push('phone');
      if (doc.querySelector('a[href^="mailto:" i]')) channels.push('email');
      if (forms.length || embeddedForm) channels.push('form');
      if (chat.length) channels.push('chat');
      checks.push(c('contact_channels', channels.length ? 'pass' : 'na', channels.length ? channels.join(', ') : 'No phone, email, form, or chat contact channel found'));
      return {checks, data};
    } catch (error) {
      return {checks: specs.map(([name]) => c(name, 'na', `Unable to inspect page: ${short(error?.message || error, 100)}`)), data: {viewport: {w: 0, h: 0}}};
    }
  }
  M.conversion = {id: 'conversion', label: 'Conversion', run};
})(globalThis);
