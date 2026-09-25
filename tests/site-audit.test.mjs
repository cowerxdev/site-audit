import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {main, parseArgs, render} from '../bin/site-audit.mjs';
import {auditOne} from '../bin/batch_audit.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const library = path.join(root, 'lib');
const scripts = ['lib.js', 'checks.js', 'data/signatures.js', 'data/libs.js',
  ...['seo', 'local', 'conversion', 'perf', 'a11y', 'trust', 'tech', 'vertical_law', 'vertical_cpa', 'vertical_trades'].map(id => `modules/${id}.js`),
  'modules/family_checks.js', 'data/schema_types.js', 'data/vertical_model.js', 'classify.js', 'engine.js'];

let JSDOM;
try { ({JSDOM} = require(process.env.SITE_AUDIT_JSDOM_PATH || 'jsdom')); } catch { /* optional in an offline checkout */ }

async function fixtureAudit(source) {
  const html = await readFile(path.join(root, 'tests/fixture.html'), 'utf8');
  const dom = new JSDOM(html, {url: 'https://fixture.test/', runScripts: 'outside-only'});
  dom.window.TextEncoder = TextEncoder;
  dom.window.AbortSignal = AbortSignal;
  try {
    for (const script of scripts) dom.window.eval(await readFile(path.join(source, script), 'utf8'));
    const value = await dom.window.SiteAuditorEngine.runAll({doc: dom.window.document, url: dom.window.location.href,
      year: 2026, win: dom.window, live: false, fetchSameOrigin: async () => null, vertical: 'trades'});
    const result = JSON.parse(JSON.stringify(value));
    delete result.auditedAt;
    delete result.durationMs;
    return result;
  } finally { dom.window.close(); }
}

async function walk(dir, prefix = '') {
  const names = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const name = path.join(prefix, entry.name);
    names.push(...(entry.isDirectory() ? await walk(path.join(dir, entry.name), name) : [name]));
  }
  return names;
}

test('standalone package includes every script used by the browser runner', async () => {
  const files = await walk(library);
  for (const script of scripts) assert.ok(files.includes(script), `Missing ${script}`);
  assert.ok(files.includes('export.cjs'));
});

test('synthetic fixture produces scored checks with evidence', {skip: !JSDOM}, async () => {
  const result = await fixtureAudit(library);
  assert.equal(result.url, 'https://fixture.test/');
  assert.equal(result.vertical, 'trades');
  assert.ok(Number.isInteger(result.score));
  assert.ok(result.modules.length >= 7);
  const seo = result.modules.find(mod => mod.id === 'seo');
  assert.ok(seo?.checks.some(check => check.evidence));
});

test('packaged browser runner falls back to all vertical packs for auto', {skip: !JSDOM}, async () => {
  const html = await readFile(path.join(root, 'tests/fixture.html'), 'utf8');
  const browser = {newPage: async () => {
    const dom = new JSDOM(html, {url: 'https://fixture.test/', runScripts: 'outside-only'});
    dom.window.TextEncoder = TextEncoder;
    dom.window.AbortSignal = AbortSignal;
    dom.window.performance.getEntriesByType = () => [];
    return {
      goto: async () => {},
      evaluate: async (script, arg) => typeof script === 'string' ? dom.window.eval(script) :
        dom.window.eval(`(${script.toString()})`)(arg),
      close: async () => dom.window.close()
    };
  }};
  const result = await auditOne(browser, 'https://fixture.test/', {vertical: 'auto'});
  assert.equal(result.error, undefined, result.error);
  assert.equal(result.vertical, 'all');
  assert.deepEqual(Array.from(result.modules.filter(mod => mod.id.startsWith('vertical_')), mod => String(mod.id)).sort(),
    ['vertical_cpa', 'vertical_law', 'vertical_trades']);
  assert.ok(Number.isInteger(result.score));
});

function fakePlaywright(score = 72) {
  return {chromium: {launch: async () => ({
    newPage: async () => {
      let url;
      return {goto: async target => { url = target; }, evaluate: async (script, args) => {
        if (typeof script === 'string') return;
        if (!args) return {};
        return {url, host: new URL(url).host, score, grade: 'C', auditedAt: '2026-09-24T00:00:00Z', modules: [
          {id: 'basics', label: 'Essentials', score, checks: [{id: 'basics.h1', label: 'Main heading', status: 'pass', weight: 1, evidence: 'Found', fix: ''}]}]};
      }, close: async () => {}};
    }, close: async () => {}
  })}};
}

function output() { let value = ''; return {stream: {write: part => { value += part; }}, get: () => value}; }

test('CLI validates arguments and fail-under returns the requested gate code', async () => {
  assert.equal(parseArgs(['https://example.test/', '--concurrency', '4']).concurrency, 4);
  assert.throws(() => parseArgs(['https://example.test/', '--vertical', 'other']), /vertical/);
  assert.throws(() => parseArgs(['https://example.test/', '--fail-under', '-1']), /fail-under/);
  assert.throws(() => parseArgs(['https://example.test/', '--json', '--csv']), /one output/);
  const failing = output(), passing = output();
  assert.equal(await main(['https://example.test/', '--fail-under', '101', '--json'], {playwright: fakePlaywright(), stdout: failing.stream}), 1);
  assert.equal(await main(['https://example.test/', '--fail-under', '0', '--json'], {playwright: fakePlaywright(), stdout: passing.stream}), 0);
  assert.equal(JSON.parse(failing.get())[0].score, 72);
  assert.match(render([{url: 'https://example.test/', score: 72, grade: 'C'}], 'md'), /\| 72 \| C \|/);
  assert.match(render([{url: 'https://example.test/', modules: []}], 'csv'), /^url,host,audited_at/);
});

test('CI config honors per-page thresholds and audit errors', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'site-audit-ci-'));
  try {
    const config = path.join(directory, '.siteaudit.json');
    await writeFile(config, JSON.stringify({vertical: 'trades', failUnder: 0, pages: [
      {url: 'https://example.test/', failUnder: 101}, 'https://other.test/']}));
    const capture = output();
    assert.equal(await main(['ci', '--config', config], {playwright: fakePlaywright(), stdout: capture.stream}), 1);
    assert.equal(capture.get().trim().split('\n').length, 2);
    await writeFile(config, JSON.stringify({vertical: 'trades', failUnder: 0, pages: ['https://example.test/']}));
    assert.equal(await main(['ci', '--config', config], {playwright: fakePlaywright(), stdout: output().stream}), 0);
  } finally { await rm(directory, {recursive: true, force: true}); }
});
