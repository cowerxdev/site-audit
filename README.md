# Site Audit

See all [Cowerx open source tools](https://cowerx.dev/open-source/).

Site Audit is an open-source command-line website checker. It opens a page in local Chromium and reports evidence for each check. It looks at page titles and descriptions, headings, image alt text, links, local business details, contact and booking paths, basic page performance, accessibility, trust signals, and technology. Optional law, accounting, and trades checks cover details specific to those sites. A score is a prompt for review, not a guarantee of search rank, accessibility compliance, or sales.

The Site Auditor Chrome extension (Chrome Web Store listing in review) runs the same checks in your browser. See the [Site Auditor page](https://cowerx.dev/site-auditor/) for the product overview.

## Quick start

Requires Node.js 20 or newer and Playwright's Chromium:

```sh
git clone https://github.com/cowerxdev/site-audit && cd site-audit
npm install && npx playwright install chromium
node bin/site-audit.mjs https://example.com --vertical trades --md
```

Example output (illustrative):

```text
| URL | Score | Grade | Status |
| --- | ---: | :---: | --- |
| https://example.com/ | 72 | C | OK |
```

Use `--json` for full checks and evidence, `--csv` for a spreadsheet, or `--md` for a summary table. Plain text is the default. `--vertical` accepts `law`, `cpa`, `trades`, or `auto`; `auto` includes all three packs. Multiple URLs are supported with `--concurrency N`. `--fail-under N` exits with code 1 when a page scores below the threshold or an audit fails. The CLI visits the URLs you provide and keeps audit results in your process unless you redirect output.

## CI gate

Save `.siteaudit.json` in your project:

```json
{
  "vertical": "trades",
  "failUnder": 75,
  "pages": [
    "https://example.com/",
    {"url": "https://example.com/contact", "failUnder": 85}
  ]
}
```

In CI, run `npx --yes github:cowerxdev/site-audit ci --config .siteaudit.json` (the package installs straight from GitHub; it is not on npm). Each page uses its own threshold when supplied. See the [sample GitHub Actions workflow](examples/site-audit.yml).

## Development

Run `npm install`, then `npm test` and `npm run test:pack` from this directory. The source files and test fixture are included here; no other repository is needed. See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. MIT licensed.
