(function (root) {
  'use strict';
  const L = root.SiteAuditorLib;
  const M = root.SiteAuditorModules = root.SiteAuditorModules || {};
  const check = (id, label, weight, status, evidence, fix) => L.check(`tech.${id}`, label, weight, status, evidence, fix);
  const definitions = [
    ['WordPress', /wordpress/i, /\/wp-content\/|\/wp-includes\//i], ['Wix', /wix/i, /wixstatic\.com|parastorage\.com/i], ['Squarespace', /squarespace/i, /squarespace(?:-cdn)?\.com|static1\.squarespace/i], ['GoDaddy Website Builder', /godaddy|starfield/i, /wsimg\.com/i], ['Weebly', /weebly/i, /weebly\.com|editmysite\.com/i], ['Shopify', /shopify/i, /cdn\.shopify\.com/i], ['Duda', /duda/i, /dudamobile\.com|cdn-website\.com/i], ['Webflow', /webflow/i, /webflow\.com|webflow\.io/i], ['Framer', /framer/i, /framerusercontent\.com|framer\.com\/m\//i], ['HubSpot CMS', /hubspot/i, /hs-sites\.com|hubspotusercontent/i], ['Showit', /showit/i, /showit\.co/i], ['Carrd', /carrd/i, /carrd\.co\/assets/i], ['Joomla', /joomla/i, /\/media\/system\/js\/|\/templates\/cassiopeia\//i], ['Drupal', /drupal/i, /\/sites\/default\/files\/|\/core\/misc\/drupal/i], ['Ghost', /ghost/i, /\/ghost\/assets\/|\/content\/themes\//i], ['BigCommerce', /bigcommerce/i, /cdn\d+\.bigcommerce\.com/i], ['Jimdo', /jimdo/i, /jimdosite\.com/i], ['Strikingly', /strikingly/i, /strikinglycdn\.com/i], ['Site123', /site123/i, /site123\.me|site123\.com/i], ['Webnode', /webnode/i, /webnode\.com/i], ['Scorpion', /scorpion/i, /scorpion\.co\/|scorpioncms/i], ['FindLaw', /findlaw|thomson reuters/i, /lawyermarketing\.com/i], ['Justia', /justia/i, /justia\.com\/|justia\.net/i], ['LawLytics', /lawlytics/i, /lawlytics\.com/i], ['ProSites', /prosites/i, /prosites\.com/i], ['Officite', /officite/i, /officite\.com/i]
  ];
  function compareVersions(a, b) { const aa = String(a).match(/\d+/g) || [], bb = String(b).match(/\d+/g) || []; for (let i = 0; i < Math.max(aa.length, bb.length); i++) { const d = (Number(aa[i]) || 0) - (Number(bb[i]) || 0); if (d) return Math.sign(d); } return 0; }
  function platform(doc) {
    const generator = L.metaContent(doc, 'name', 'generator');
    const assets = [...doc.querySelectorAll('script[src],link[href],img[src]')].slice(0, 1000).map(el => el.getAttribute('src') || el.getAttribute('href'));
    let result = null;
    for (const [name, gen, path] of definitions) { const hit = gen.test(generator) ? generator : assets.find(src => path.test(src)); if (hit) { result = {name, evidence: L.trim(hit, 100), builders: [], seoPlugin: null}; break; } }
    if (!result) return null;
    if (result.name === 'WordPress') {
      const joined = assets.join(' '), theme = joined.match(/\/wp-content\/themes\/([^/?/]+)/i); if (theme) result.theme = theme[1];
      for (const [name, re] of [['Elementor', /elementor/i], ['Divi', /\/Divi\/|et-builder/i], ['WPBakery', /js_composer|wpbakery/i], ['Beaver Builder', /bb-plugin|beaver-builder/i], ['Avada/Fusion', /fusion-builder|avada/i], ['Oxygen', /oxygen/i], ['Bricks', /\/bricks\//i], ['Gutenberg', /wp-block-|\/blocks\//i]]) if (re.test(joined) || re.test(doc.body?.className || '')) result.builders.push(name);
      for (const [name, re] of [['Yoast', /wordpress-seo|yoast/i], ['Rank Math', /seo-by-rank-math|rank-math/i], ['AIOSEO', /all-in-one-seo-pack|aioseo/i]]) if (re.test(joined) || re.test(generator)) { result.seoPlugin = name; break; }
    }
    return result;
  }
  const libPatterns = [['jqueryUi', /jquery[.-]ui/i], ['jqueryMigrate', /jquery[.-]migrate/i], ['jquery', /jquery(?![.-](?:ui|migrate))/i], ['bootstrap', /bootstrap/i], ['angularjs', /angular(?:\.min)?\.js|angularjs/i], ['react', /react(?:\.production|\.development|\.min)?\.js|react@/i], ['vue', /vue(?:\.runtime|\.global|\.min)?\.js|vue@/i], ['moment', /moment/i], ['lodash', /lodash/i], ['underscore', /underscore/i], ['swiper', /swiper/i], ['gsap', /gsap/i], ['modernizr', /modernizr/i]];
  function versions(ctx) {
    const found = new Map(); const defs = root.SiteAuditorLibs?.libs || {};
    for (const key of Object.keys(defs)) { const value = ctx.globals?.[key]; if (typeof value === 'string' && /\d/.test(value)) found.set(key, value); }
    for (const el of [...ctx.doc.querySelectorAll('script[src]')].slice(0, 500)) {
      const src = el.getAttribute('src') || '';
      let filename = ''; try { filename = new URL(src, ctx.url).pathname.split('/').pop() || ''; } catch (_) { /* malformed URL */ }
      const match = libPatterns.find(([key, re]) => re.test(key === 'lodash' || key === 'underscore' ? filename : src)); if (!match || found.has(match[0])) continue;
      const version = src.match(/(?:@|[./_-]|[?&](?:ver|version|v)=|\/)(v?\d+\.\d+(?:\.\d+)?)(?=\D|$)/i)?.[1];
      if (version) found.set(match[0], version.replace(/^v/i, ''));
    }
    return [...found].map(([key, version]) => ({key, version, ...defs[key]}));
  }
  function run(ctx) {
    try {
      const {doc, url} = ctx, checks = [], data = {};
      data.platform = platform(doc);
      checks.push(check('platform', 'Site platform', 0, data.platform ? 'pass' : 'na', data.platform ? `${data.platform.name}: ${data.platform.evidence}${data.platform.theme ? `; theme ${data.platform.theme}` : ''}${data.platform.builders.length ? `; ${data.platform.builders.join(', ')}` : ''}` : 'No platform signature detected', ''));
      const libs = versions(ctx); data.libraries = libs;
      const obsolete = libs.filter(lib => lib.eol || (lib.eolBelow && compareVersions(lib.version, lib.eolBelow) < 0) || (lib.key === 'jquery' && compareVersions(lib.version, lib.outdatedBelow) < 0) || (lib.key === 'lodash' && compareVersions(lib.version, lib.outdatedBelow) < 0));
      const old = libs.filter(lib => !obsolete.includes(lib) && (lib.maintenance || compareVersions(lib.version, lib.outdatedBelow) < 0));
      const datedLib = obsolete[0] || old[0];
      checks.push(check('libraries', 'JavaScript libraries', 2, !libs.length ? 'na' : obsolete.length ? 'fail' : old.length ? 'warn' : 'pass', libs.length ? libs.map(lib => `${lib.name} ${lib.version}${obsolete.includes(lib) ? ` (outdated: ${lib.note})` : old.includes(lib) ? ` (older: ${lib.note})` : ''}`).join(', ') : 'No versioned libraries detected', `The homepage loads ${datedLib?.name} ${datedLib?.version}, an older software version that may miss current security or browser fixes.`));
      const https = new URL(url).protocol === 'https:'; const mixed = [];
      const sels = [['img[src],img[srcset],source[src],source[srcset],video[src],audio[src]', 'passive'], ['script[src],link[rel~="stylesheet"][href],iframe[src],form[action],object[data]', 'active']];
      for (const [selector, type] of sels) for (const el of [...doc.querySelectorAll(selector)].slice(0, 1000)) for (const attr of ['src', 'srcset', 'href', 'action', 'data']) { const value = el.getAttribute(attr) || ''; if (attr === 'srcset') { for (const item of value.split(',')) if (/^\s*http:\/\//i.test(item)) mixed.push({type, url: item.trim().split(/\s+/)[0]}); } else if (/^http:\/\//i.test(value)) mixed.push({type, url: value}); }
      if (ctx.live) { let resources = []; try { resources = ctx.win.performance.getEntriesByType('resource'); } catch (_) { /* unavailable */ } for (const r of resources.slice(0, 2000)) if (/^http:\/\//i.test(r.name)) mixed.push({type: /^(img|image|video|audio)$/i.test(r.initiatorType) ? 'passive' : 'active', url: r.name}); }
      data.mixedContent = mixed;
      checks.push(check('mixed_content', 'Mixed content', 2, !https ? 'na' : mixed.some(x => x.type === 'active') ? 'fail' : mixed.length ? 'warn' : 'pass', !https ? 'Page itself is HTTP' : mixed.length ? `${mixed.length} HTTP resource URLs; ${mixed.slice(0, 3).map(x => x.url).join(', ')}` : 'No HTTP resource URLs found', `The secure homepage loads ${mixed.length} file ${mixed.length === 1 ? 'address' : 'addresses'} over an unsecured connection, so browsers may block them or flag the page.`));
      const internalHttp = https ? [...doc.querySelectorAll('a[href^="http://" i]')].slice(0, 2000).filter(el => { try { return L.siteDomain(new URL(el.href).hostname) === L.siteDomain(ctx.host); } catch (_) { return false; } }) : [];
      data.httpsLinks = internalHttp.length;
      checks.push(check('https_links', 'Internal HTTP links', 0, !https ? 'na' : internalHttp.length ? 'warn' : 'pass', !https ? 'Page itself is HTTP' : `${internalHttp.length} internal links use HTTP`, `The homepage has ${internalHttp.length} links to unsecured versions of its own pages, so visitors may leave the secure address.`));
      return {checks, data};
    } catch (err) { return {checks: [check('unavailable', 'Tech', 0, 'na', `Could not inspect site technology: ${err.message}`, '')], data: {}}; }
  }
  M.tech = {id: 'tech', label: 'Tech', run: async ctx => run(ctx), compareVersions};
})(globalThis);
