(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const check = (id, label, weight, status, evidence, fix) => L.check(`a11y.${id}`, label, weight, status, evidence, fix);
  function parseColor(css) {
    const s = String(css || '').trim().toLowerCase();
    let m = s.match(/^#([0-9a-f]{3,8})$/i);
    if (m) { let h = m[1]; if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join(''); if (h.length !== 6 && h.length !== 8) return null; return {r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1}; }
    m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (!m) return null;
    const alpha = m[4] ? parseFloat(m[4]) / (m[4].endsWith('%') ? 100 : 1) : 1;
    return {r: +m[1], g: +m[2], b: +m[3], a: Math.max(0, Math.min(1, alpha))};
  }
  const over = (front, back) => ({r: front.r * front.a + back.r * (1 - front.a), g: front.g * front.a + back.g * (1 - front.a), b: front.b * front.a + back.b * (1 - front.a), a: 1});
  function contrastRatio(a, b) {
    const lum = c => { const x = [c.r, c.g, c.b].map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }); return x[0] * .2126 + x[1] * .7152 + x[2] * .0722; };
    const aa = lum(a), bb = lum(b); return (Math.max(aa, bb) + .05) / (Math.min(aa, bb) + .05);
  }
  const shown = (el, win) => { const r = el.getBoundingClientRect(); const s = win.getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0; };
  const hiddenClass = /(^|[\s_-])(sr-only|screen-reader|visually-hidden|visuallyhidden|hidden|assistive|a11y-hidden|elementor-screen-only)([\s_-]|$)/i;
  function clipped(style, rect) {
    const clip = style.clip || '';
    const values = clip.match(/^rect\(\s*(-?[\d.]+)px[,\s]+(-?[\d.]+)px[,\s]+(-?[\d.]+)px[,\s]+(-?[\d.]+)px\s*\)$/i);
    if (values && (+values[3] - +values[1] <= 1 || +values[2] - +values[4] <= 1)) return true;
    const path = style.clipPath || '';
    const circle = path.match(/^circle\(\s*([\d.]+)(px|%)/i);
    if (circle && +circle[1] * (circle[2] === '%' ? Math.min(rect.width, rect.height) / 100 : 1) <= 1) return true;
    const ellipse = path.match(/^ellipse\(\s*([\d.]+)(px|%)\s+([\d.]+)(px|%)/i);
    if (ellipse && (+ellipse[1] * (ellipse[2] === '%' ? rect.width / 100 : 1) <= 1 || +ellipse[3] * (ellipse[4] === '%' ? rect.height / 100 : 1) <= 1)) return true;
    const inset = path.match(/^inset\(([^)]+)\)/i);
    if (inset) {
      const parts = inset[1].split(/\s+|,/).filter(Boolean).slice(0, 4);
      const px = (value, dimension) => value.endsWith('%') ? parseFloat(value) * dimension / 100 : parseFloat(value);
      if (parts.every(part => /^-?[\d.]+(?:px|%)$/.test(part))) {
        const top = px(parts[0], rect.height), right = px(parts[1] || parts[0], rect.width);
        const bottom = px(parts[2] || parts[0], rect.height), left = px(parts[3] || parts[1] || parts[0], rect.width);
        if (rect.width - left - right <= 1 || rect.height - top - bottom <= 1) return true;
      }
    }
    return /^(?:polygon|path)\(\s*(?:0(?:px|%)?[,\s]+){2,}/i.test(path);
  }
  function visibleText(el, win, doc) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 2 || rect.height <= 2 || rect.right <= 0 || rect.left >= doc.documentElement.scrollWidth || rect.bottom <= 0) return false;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (hiddenClass.test(node.getAttribute('class') || '')) return false;
      const style = win.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0 || clipped(style, node.getBoundingClientRect())) return false;
    }
    const style = win.getComputedStyle(el);
    if (parseFloat(style.fontSize) < 6 || parseFloat(style.textIndent) < -999) return false;
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    if (x >= 0 && x < win.innerWidth && y >= 0 && y < win.innerHeight) {
      const hit = doc.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) return false;
    }
    return true;
  }
  const file = url => { try { return new URL(url, 'https://example.test').pathname.split('/').pop() || 'image'; } catch (_) { return 'image'; } };
  function inlineTextLink(el, win, cache) {
    if (!el.matches('a')) return false;
    let block = el.parentElement;
    while (block && !/^(?:block|list-item|table-cell|flex|grid)$/.test(win.getComputedStyle(block).display)) block = block.parentElement;
    if (!block || block === el) return false;
    if (cache.has(block)) return cache.get(block);
    const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let value = '', node, visited = 0;
    while (L.trim(value).length < 20 && (node = walker.nextNode()) && ++visited <= 500) if (!node.parentElement.closest('a')) value += node.textContent;
    const result = L.trim(value).length >= 20;
    cache.set(block, result);
    return result;
  }
  function targetLabel(el) {
    let path = '';
    try { path = decodeURIComponent(new URL(el.getAttribute('href') || '', el.ownerDocument.baseURI).pathname.split('/').filter(Boolean).pop() || ''); } catch (_) { path = String(el.getAttribute('href') || '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || ''; }
    return L.trim(L.trim(el.textContent) || L.trim(el.getAttribute('aria-label')) || L.trim(el.getAttribute('title')) || L.trim(el.querySelector('img[alt]')?.getAttribute('alt')) || path || el.name || el.tagName.toLowerCase(), 25);
  }
  function uncertainBackground(ancestors, win) {
    for (const node of ancestors) {
      const style = win.getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== 'none') return true;
      for (const pseudo of ['::before', '::after']) {
        const ps = win.getComputedStyle(node, pseudo);
        if ((ps.backgroundImage && ps.backgroundImage !== 'none') || (parseColor(ps.backgroundColor)?.a || 0) > 0) return true;
      }
      if (['absolute', 'fixed', 'sticky'].includes(style.position) && node.parentElement &&
          [...node.parentElement.children].some(sibling => sibling !== node && (sibling.matches('img,video,picture,iframe') || sibling.querySelector('img,video,picture,iframe')))) return true;
    }
    return false;
  }
  function run(ctx) {
    try {
      const {doc, win} = ctx; const checks = []; const data = {contrastFailures: []};
      const lang = L.trim(doc.documentElement.getAttribute('lang'));
      checks.push(check('lang', 'Page language', 2, lang ? 'pass' : 'fail', lang ? `html lang="${lang}"` : 'html has no lang attribute', 'The page does not declare its language for screen readers.'));
      const fields = [...doc.querySelectorAll('input,select,textarea')].slice(0, 400).filter(el => !['hidden', 'submit', 'button', 'image', 'reset'].includes(el.type) && shown(el, win));
      const labelsById = new Set([...doc.querySelectorAll('label[for]')].slice(0, 2000).filter(label => L.trim(label.textContent)).map(label => label.htmlFor));
      const missing = [], placeholders = [];
      for (const el of fields) {
        const id = el.id && labelsById.has(el.id);
        const labelled = id || el.closest('label')?.textContent.trim() || L.trim(el.getAttribute('aria-label')) || (el.getAttribute('aria-labelledby') || '').split(/\s+/).some(ref => L.trim(doc.getElementById(ref)?.textContent)) || L.trim(el.getAttribute('title'));
        if (!labelled) (el.placeholder ? placeholders : missing).push(L.trim(el.name || el.id || el.type || el.tagName.toLowerCase(), 25));
      }
      const labelState = missing.length ? 'fail' : placeholders.length ? 'warn' : 'pass';
      checks.push(check('labels', 'Form field labels', 2, labelState, missing.length ? `${missing.length} of ${fields.length} fields have no label (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', …' : ''})` : placeholders.length ? `${placeholders.length} of ${fields.length} fields use placeholder alone (${placeholders.slice(0, 3).join(', ')})` : `${fields.length} visible fields have accessible names`, missing.length ? `${missing.length} of ${fields.length} form fields have no persistent label, so screen reader users may not know what to enter.` : `${placeholders.length} of ${fields.length} form fields rely on placeholder text, which disappears when visitors start typing.`));
      const noAlt = [...doc.images].slice(0, 400).filter(el => !el.hasAttribute('alt') && el.getAttribute('aria-hidden') !== 'true' && el.getAttribute('role') !== 'presentation' && !(el.naturalWidth <= 1 && el.naturalHeight <= 1 && el.naturalWidth > 0));
      checks.push(check('alt', 'Image alt text', 2, noAlt.length === 0 ? 'pass' : noAlt.length <= 3 ? 'warn' : 'fail', noAlt.length ? `${noAlt.length} images lack alt: ${noAlt.slice(0, 3).map(el => file(el.src)).join(', ')}` : 'All sampled images have alt attributes', `${noAlt.length} images, including ${L.trim(file(noAlt[0]?.src), 50)}, have no text description, so screen readers cannot explain their purpose.`));
      const inlineCache = new WeakMap();
      const targets = [...doc.querySelectorAll('a,button,input,select,[role="button"]')].slice(0, 1000).filter(el => { const r = el.getBoundingClientRect(); return shown(el, win) && r.bottom > 0 && r.right > 0 && r.top < win.innerHeight && r.left < win.innerWidth && !inlineTextLink(el, win, inlineCache); }).slice(0, 60);
      const under24 = targets.filter(el => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; });
      const under44 = targets.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
      const example = under24[0] || under44[0]; const rect = example?.getBoundingClientRect();
      const tapState = targets.length < 10 ? under44.length ? 'warn' : 'pass' : under24.length / targets.length > .3 ? 'fail' : under44.length / targets.length > .1 ? 'warn' : 'pass';
      checks.push(check('tap_targets', 'Tap target size', 1, tapState, `${under24.length} of ${targets.length} under 24×24 px (AA minimum), ${under44.length} of ${targets.length} under 44×44 px (AAA)${example ? `; e.g. '${targetLabel(example)}' ${Math.round(rect.width)}×${Math.round(rect.height)}` : ''}${targets.length < 10 ? '; fewer than 10 sampled targets' : ''}`, under24.length ? `${under24.length} of ${targets.length} buttons or links are under 24×24 pixels, so they can be hard to tap on a phone.` : `${under44.length} of ${targets.length} buttons or links are under 44×44 pixels, so they can be hard to tap on a phone.`));
      let sampled = 0, undetermined = 0; const failures = [];
      for (const el of [...doc.querySelectorAll('body *')].slice(0, 2000)) {
        if (sampled >= 150) break;
        if (![...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()) || !visibleText(el, win, doc)) continue;
        const style = win.getComputedStyle(el); const font = parseFloat(style.fontSize); const foreground = parseColor(style.color);
        if (!font || !foreground) continue;
        const ancestors = []; for (let node = el; node && node.nodeType === 1; node = node.parentElement) ancestors.push(node);
        if (L.trim(el.textContent).length <= 2 || /awesome|icon|dashicons|eicons|glyph|material/i.test(style.fontFamily) || el.matches('i') || el.closest('[aria-hidden="true"]') || uncertainBackground(ancestors, win)) { undetermined++; continue; }
        let bg = {r: 255, g: 255, b: 255, a: 1};
        for (const node of ancestors.reverse()) { const c = parseColor(win.getComputedStyle(node).backgroundColor); if (c && c.a) bg = over(c, bg); }
        const fg = over(foreground, bg); const ratio = contrastRatio(fg, bg);
        if (ratio < 1.25) { undetermined++; continue; }
        sampled++;
        const large = font >= 24 || (font >= 18.66 && (parseInt(style.fontWeight, 10) || (style.fontWeight === 'bold' ? 700 : 400)) >= 700);
        if (ratio < (large ? 3 : 4.5)) failures.push({text: L.trim(el.textContent, 45), ratio: +ratio.toFixed(2), foreground: style.color, background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`});
      }
      failures.sort((a, b) => a.ratio - b.ratio); data.contrastFailures = failures.slice(0, 10);
      const worst = failures[0]; const pct = sampled ? failures.length / sampled : 0;
      checks.push(check('contrast', 'Text contrast', 2, sampled === 0 ? 'na' : sampled < 10 ? failures.length ? 'warn' : 'pass' : pct <= .05 ? 'pass' : pct <= .15 ? 'warn' : 'fail', `${failures.length} of ${sampled} determined text runs below AA${worst ? `; worst ${worst.ratio}:1 '${worst.foreground} on ${worst.background}' '${worst.text}'` : ''}; ${undetermined} undetermined${sampled < 10 ? '; fewer than 10 determined samples, status capped at warn' : ''}`, `${failures.length} of ${sampled} sampled text lines, including “${L.trim(worst?.text, 45)}”, are faint against their backgrounds, so some visitors may struggle to read them.`));
      return {checks, data};
    } catch (err) { return {checks: [check('unavailable', 'Accessibility', 0, 'na', `Could not inspect accessibility: ${err.message}`, '')], data: {contrastFailures: []}}; }
  }
  M.a11y = {id: 'a11y', label: 'Accessibility', run: async ctx => run(ctx), contrastRatio, parseColor};
})(globalThis);
