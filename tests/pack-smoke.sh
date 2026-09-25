#!/usr/bin/env bash
set -euo pipefail

package_root="$(cd "$(dirname "$0")/.." && pwd)"
scratch="$(mktemp -d /tmp/site-audit-pack-XXXXXX)"
trap 'rm -rf "$scratch"' EXIT
export npm_config_cache="$scratch/npm-cache"

cd "$package_root"
npm pack --dry-run --json --offline --silent > "$scratch/dry-run.json"
node - "$scratch/dry-run.json" <<'JS'
const fs = require('node:fs');
const paths = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))[0].files.map(file => file.path);
if (paths.some(name => /(^|\/)(tests|node_modules|fixtures?)(\/|$)/.test(name))) {
  throw new Error('Fixture or test file included in tarball');
}
if (!paths.includes('bin/site-audit.mjs') || !paths.includes('lib/engine.js')) {
  throw new Error('CLI or engine missing from tarball');
}
JS

tarball="$(npm pack --pack-destination "$scratch" --offline --silent)"
npm install --offline --ignore-scripts --legacy-peer-deps --prefix "$scratch/install" "$scratch/$tarball" --silent
bin="$scratch/install/node_modules/.bin/site-audit"
"$bin" --help > "$scratch/help.txt"
rg -q 'Usage: site-audit' "$scratch/help.txt"

# A local peer stub verifies the installed CLI's audit and exit-code path
# without depending on a browser or network service in CI.
mkdir -p "$scratch/install/node_modules/playwright"
cat > "$scratch/install/node_modules/playwright/index.js" <<'JS'
module.exports = {chromium: {launch: async () => ({
  newPage: async () => {
    let url;
    return {
      goto: async value => { url = value; },
      evaluate: async (script, args) => typeof script === 'string' ? undefined : args ?
        {url, host: new URL(url).host, score: 72, grade: 'C', modules: []} : {},
      close: async () => {}
    };
  },
  close: async () => {}
})}};
JS

if "$bin" https://example.test --fail-under 101 --json > "$scratch/fail.json"; then
  echo 'Expected --fail-under 101 to exit 1' >&2
  exit 1
fi
"$bin" https://example.test --fail-under 0 --json > "$scratch/pass.json"
node - "$scratch/pass.json" <<'JS'
const fs = require('node:fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (result.length !== 1 || result[0].score !== 72) throw new Error('Installed CLI did not audit');
JS
echo 'pack dry-run, offline tarball install, and installed CLI: passed'
