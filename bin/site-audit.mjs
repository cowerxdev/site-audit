#!/usr/bin/env node
import {readFile, realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {runBatch} from './batch_audit.mjs';

const require = createRequire(import.meta.url);
const usage = 'Usage: site-audit <url...> [--vertical law|cpa|trades|auto] [--json|--csv|--md] [--fail-under N] [--concurrency 4]\n       site-audit ci --config .siteaudit.json';

export function parseArgs(args) {
  const options = {urls: [], vertical: 'auto', format: 'text', concurrency: 4, failUnder: null, config: '.siteaudit.json', ci: false};
  let i = 0;
  if (args[0] === 'ci') { options.ci = true; i++; }
  for (; i < args.length; i++) {
    const arg = args[i];
    if (['--json', '--csv', '--md'].includes(arg)) {
      if (options.format !== 'text') throw new Error('Choose one output format');
      options.format = arg.slice(2);
    } else if (['--vertical', '--fail-under', '--concurrency', '--config'].includes(arg)) {
      const value = args[++i];
      if (value == null || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[{ '--vertical': 'vertical', '--fail-under': 'failUnder', '--concurrency': 'concurrency', '--config': 'config'}[arg]] = value;
    } else if (arg === '--help' || arg === '-h') { options.help = true; }
    else if (!arg.startsWith('-') && !options.ci) options.urls.push(arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['auto', 'law', 'cpa', 'trades'].includes(options.vertical)) throw new Error('Invalid vertical');
  options.concurrency = Number(options.concurrency);
  if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1) throw new Error('concurrency must be a positive integer');
  if (options.failUnder !== null) options.failUnder = threshold(options.failUnder);
  if (!options.help && !options.ci && !options.urls.length) throw new Error(usage);
  if (!options.help && options.ci && options.urls.length) throw new Error(usage);
  return options;
}

function threshold(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 101) throw new Error('fail-under must be an integer from 0 to 101');
  return n;
}

function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function render(results, format) {
  if (format === 'json') return JSON.stringify(results, null, 2) + '\n';
  if (format === 'csv') {
    const columns = ['url', 'host', 'audited_at', 'module', 'check_id', 'label', 'status', 'weight', 'evidence', 'fix'];
    const rows = results.flatMap(result => (result.modules || []).flatMap(mod => (mod.checks || []).map(check =>
      [result.url, result.host, result.auditedAt, mod.label, check.id, check.label, check.status, check.weight, check.evidence, check.fix])));
    return [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  if (format === 'md') return ['| URL | Score | Grade | Status |', '| --- | ---: | :---: | --- |', ...results.map(row =>
    `| ${String(row.url).replaceAll('|', '\\|')} | ${row.score ?? '—'} | ${row.grade ?? '—'} | ${row.error ? String(row.error).replaceAll('|', '\\|') : 'OK'} |`)].join('\n') + '\n';
  return results.map(row => row.error ? `${row.url}: ERROR ${row.error}` : `${row.url}: ${row.score}/100 (${row.grade})`).join('\n') + '\n';
}

export async function main(args = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(args);
  if (options.help) { (dependencies.stdout || process.stdout).write(usage + '\n'); return 0; }
  let pages = options.urls.map(url => ({url, failUnder: options.failUnder}));
  if (options.ci) {
    const config = JSON.parse(await readFile(options.config, 'utf8'));
    const entries = config.pages || config.urls;
    if (!Array.isArray(entries) || !entries.length) throw new Error('Config needs a nonempty pages array');
    const defaultThreshold = threshold(config.failUnder ?? options.failUnder ?? 0);
    pages = entries.map(entry => typeof entry === 'string' ? {url: entry, failUnder: defaultThreshold} :
      {url: entry.url, failUnder: threshold(entry.failUnder ?? defaultThreshold)});
    options.vertical = config.vertical || options.vertical;
    if (!['auto', 'law', 'cpa', 'trades'].includes(options.vertical)) throw new Error('Invalid vertical in config');
    options.format = config.format || options.format;
  }
  for (const page of pages) {
    if (typeof page.url !== 'string' || !/^https?:\/\//i.test(page.url)) throw new Error(`Invalid URL: ${page.url}`);
  }
  const playwright = dependencies.playwright || require('playwright');
  const results = await runBatch(pages.map(page => page.url), options, playwright);
  (dependencies.stdout || process.stdout).write(render(results, options.format));
  return results.some((row, i) => row.error || (pages[i].failUnder !== null && (row.score == null || row.score < pages[i].failUnder))) ? 1 : 0;
}

if (process.argv[1] && await realpath(path.resolve(process.argv[1])).catch(() => '') === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message || error); process.exitCode = 1; });
}
