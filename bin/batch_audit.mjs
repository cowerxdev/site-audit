#!/usr/bin/env node
// Run the extension's shipped audit scripts in Playwright Chromium.
import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const EXTENSION = fileURLToPath(new URL('../lib/', import.meta.url));
const SCRIPTS = [
  'lib.js', 'checks.js', 'data/signatures.js', 'data/libs.js',
  'modules/seo.js', 'modules/local.js', 'modules/conversion.js',
  'modules/perf.js', 'modules/a11y.js', 'modules/trust.js',
  'modules/tech.js', 'modules/family_checks.js', 'modules/vertical_law.js',
  'modules/vertical_cpa.js', 'modules/vertical_trades.js',
  'data/schema_types.js', 'data/vertical_model.js', 'classify.js', 'engine.js'
];
let sourcesPromise;
function sources() {
  return sourcesPromise ||= Promise.all(SCRIPTS.map(script => readFile(path.join(EXTENSION, script), 'utf8')));
}

export function parseArgs(args) {
  const options = {vertical: 'auto', out: 'audit.jsonl', csv: 'audit.csv', concurrency: 4, timeout: 30000};
  if (!args.length || args[0].startsWith('--')) throw new Error('Usage: batch_audit.mjs urls.txt --vertical auto --out audit.jsonl --csv audit.csv --concurrency 4');
  options.input = args[0];
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i]?.slice(2);
    if (!args[i]?.startsWith('--') || !['vertical', 'out', 'csv', 'concurrency', 'timeout'].includes(key) || !args[i + 1]) throw new Error(`Invalid option: ${args[i] || ''}`);
    options[key] = args[i + 1];
  }
  if (!['auto', 'law', 'cpa', 'trades', 'general', 'professional-services',
    'appointment-services', 'food-and-venue', 'blue-collar-trades',
    'lessons-and-instruction', 'retail-and-e-commerce', 'community',
    'web-apps-and-products'].includes(options.vertical)) throw new Error(`Invalid vertical: ${options.vertical}`);
  for (const key of ['concurrency', 'timeout']) {
    options[key] = Number(options[key]);
    if (!Number.isSafeInteger(options[key]) || options[key] < 1) throw new Error(`${key} must be a positive integer`);
  }
  return options;
}

// This is the popup's MAIN-world version probe. Pass only strings into the audit.
function readGlobals() {
  try {
    const versions = {
      jquery: window.jQuery?.fn?.jquery, jqueryUi: window.jQuery?.ui?.version, jqueryMigrate: window.jQuery?.migrateVersion,
      bootstrap: window.bootstrap?.Tooltip?.VERSION || window.jQuery?.fn?.tooltip?.Constructor?.VERSION,
      react: window.React?.version, vue: window.Vue?.version, angularjs: window.angular?.version?.full,
      angular: document.querySelector('[ng-version]')?.getAttribute('ng-version'), gsap: window.gsap?.version,
      lodash: typeof window._?.cloneDeep === 'function' ? window._.VERSION : undefined,
      underscore: typeof window._?.cloneDeep === 'function' ? window.Underscore?.VERSION : window._?.VERSION || window.Underscore?.VERSION,
      moment: window.moment?.version, swiper: window.Swiper?.version || window.Swiper?.prototype?.version,
      modernizr: window.Modernizr?._version
    };
    return Object.fromEntries(Object.entries(versions).filter(([, value]) => typeof value === 'string'));
  } catch (_) { return {}; }
}

export async function auditOne(browser, rawUrl, {vertical = 'auto', timeout = 30000} = {}) {
  let page;
  let timer;
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported');
    page = await browser.newPage(process.env.COWERX_AUDIT_CRAWL ? {userAgent: 'CowerxBot/1.0 (+https://cowerx.com)'} : {});
    if (process.env.COWERX_AUDIT_CRAWL) {
      // The report already checked robots for the target URL. Keep the audit to
      // that document: subresources and in-page fetches would need independent
      // robots checks and could exceed the per-host request rate.
      const host = parsed.host;
      await page.route('**/*', route => {
        const request = route.request();
        const target = new URL(request.url());
        if (request.isNavigationRequest() && request.resourceType() === 'document' && target.host === host) {
          return route.continue();
        }
        return route.abort();
      });
    }
    const activePage = page;
    const work = (async () => {
      await activePage.goto(rawUrl, {waitUntil: 'load', timeout});
      const globals = await activePage.evaluate(readGlobals);
      // DevTools evaluation, like chrome.scripting.executeScript, works on
      // pages whose CSP rejects inline <script> elements.
      for (const source of await sources()) await activePage.evaluate(source);
      const result = await activePage.evaluate(async ({globals, vertical}) => {
        const engine = globalThis.SiteAuditorEngine;
        const navigation = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource');
        const timings = {
          ttfb: navigation ? Math.round(navigation.responseStart) : null,
          load: navigation ? Math.round(navigation.loadEventEnd) : null,
          kb: Math.round((resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) + (navigation?.transferSize || 0)) / 1024),
          requests: resources.length,
          scripts: resources.filter(entry => entry.initiatorType === 'script').length,
          css: resources.filter(entry => entry.initiatorType === 'link').length
        };
        const first = await engine.runAll({doc: document, url: location.href, year: new Date().getFullYear(), win: window, live: true,
          globals, perf: {...timings, ...await engine.collectPerf(window)}, fetchSameOrigin: engine.defaultFetch,
          vertical: vertical === 'auto' ? null : vertical});
        if (vertical === 'auto') {
          for (const pack of ['law', 'cpa', 'trades']) {
            if (pack === first.vertical) continue;
            const extra = await engine.runAll({doc: document, url: location.href, year: new Date().getFullYear(), win: window, live: true,
              globals, perf: {...timings, ...await engine.collectPerf(window)}, fetchSameOrigin: engine.defaultFetch, vertical: pack});
            first.modules.push(...extra.modules.filter(mod => mod.id === 'vertical_' + pack));
          }
          first.vertical = 'all';
          first.score = engine.overall(first.modules);
          first.grade = globalThis.SiteAuditorLib.grade(first.score);
        }
        return first;
      }, {globals, vertical});
      if (!result || !Array.isArray(result.modules) || !/^https?:\/\//i.test(result.url)) throw new Error('No audit result');
      return result;
    })();
    // Closing the page interrupts a stalled evaluate as well as a stalled load.
    return await Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => { activePage.close().catch(() => {}); reject(new Error(`Timed out after ${timeout} ms`)); }, timeout);
    })]);
  } catch (err) {
    return {url: rawUrl, error: String(err?.message || err).split('\n')[0]};
  } finally {
    clearTimeout(timer);
    if (page) await page.close().catch(() => {});
  }
}

export async function runBatch(urls, options, playwright = require('playwright')) {
  const browser = await playwright.chromium.launch({headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {})});
  const results = new Array(urls.length);
  let next = 0;
  try {
    await Promise.all(Array.from({length: Math.min(options.concurrency, urls.length)}, async () => {
      while (next < urls.length) {
        const index = next++;
        results[index] = await auditOne(browser, urls[index], options);
      }
    }));
  } finally { await browser.close(); }
  return results;
}

export async function main(args = process.argv.slice(2), playwright) {
  const options = parseArgs(args);
  const urls = (await readFile(options.input, 'utf8')).split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const results = await runBatch(urls, options, playwright || require('playwright'));
  await writeFile(options.out, results.map(result => JSON.stringify(result)).join('\n') + (results.length ? '\n' : ''));
  const {toCsvMany} = require(path.join(EXTENSION, 'export.cjs'));
  await writeFile(options.csv, toCsvMany(results.filter(result => !result.error)));
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(results => console.log(`Audited ${results.length} URLs; ${results.filter(result => result.error).length} errors`))
    .catch(err => { console.error(err?.message || err); process.exitCode = 1; });
}
