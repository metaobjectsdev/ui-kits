// Guards the CSS packages. Fails (exit 1) when:
//  - a stylesheet uses anything a `default-src 'none'` content policy blocks
//    (url(), @font-face, image-set(), a remote @import);
//  - the pinned-dark and auto-dark token blocks in tokens.css drift apart;
//  - components.css has a rule outside `@layer ak` or a class without the ak- prefix;
//  - admin-react emits an ak- class that components.css does not define;
//  - a package file names a brand, an app or a local path;
//  - the --series-* chart palette is not declared once on :root, or a slot falls under 3:1
//    against either theme's --surface;
//  - components.css has no narrow-chart (@container, <= 480px) rule hiding .ak-chart-tick-minor;
//  - tokens.json is out of date or is not valid DTCG (every token has $value and $type, every
//    alias resolves), or admin.css is out of date with tokens.css and components.css;
//  - package metadata drifts: names, one shared version, Apache-2.0, `access: public` and the
//    `preview` tag, LICENSE and NOTICE copies, no registry host and no non-kit runtime dependency;
//  - the Tailwind 4 bridge does not compile into token-backed utilities and a dark variant.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];
const fail = (message) => failures.push(message);

const sheets = {
  'packages/admin-tokens/tokens.css': read('packages/admin-tokens/tokens.css'),
  'packages/admin-tokens/tailwind.css': read('packages/admin-tokens/tailwind.css'),
  'packages/admin-css/components.css': read('packages/admin-css/components.css'),
  'packages/admin-css/admin.css': read('packages/admin-css/admin.css'),
};

// 1. Content-policy safety.
for (const [path, css] of Object.entries(sheets)) {
  const code = stripComments(css);
  if (/url\s*\(/i.test(code)) fail(`${path}: uses url()`);
  if (/@font-face/i.test(code)) fail(`${path}: declares @font-face`);
  if (/image-set\s*\(/i.test(code)) fail(`${path}: uses image-set()`);
  for (const [, target] of code.matchAll(/@import\s+["']([^"']+)["']/g)) {
    if (!target.startsWith('./')) fail(`${path}: @import of ${target} (only sibling files are allowed)`);
  }
}

// 2. The two dark blocks must match.
const tokens = sheets['packages/admin-tokens/tokens.css'];
function marked(name) {
  const match = tokens.match(new RegExp(`/\\* dark:${name}:start \\*/([\\s\\S]*?)/\\* dark:${name}:end \\*/`));
  if (!match) {
    fail(`tokens.css: missing dark:${name} markers`);
    return '';
  }
  const body = match[1];
  return body.slice(body.indexOf('{') + 1, body.lastIndexOf('}')).replace(/\s+/g, ' ').trim();
}
if (marked('pinned') !== marked('auto')) fail('tokens.css: the [data-theme="dark"] block and the auto-dark block differ');

// 2b. The chart series palette is one palette for light and dark: declared once, on the
// theme-independent :root block, and every slot holds 3:1 against both surfaces.
{
  const code = stripComments(tokens);
  const blocks = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim(), body]);
  const series = {};
  for (const [selector, body] of blocks) {
    for (const [, name, value] of body.matchAll(/--(series-[\w-]+):\s*([^;]+);/g)) {
      if (selector !== ':root') fail(`tokens.css: --${name} is set in "${selector}"; the series palette lives on :root only`);
      else series[name] = value.trim();
    }
  }
  const names = ['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6', 'series-other'];
  const surfaces = {
    light: blocks.find(([s]) => s.startsWith(':root,'))?.[1].match(/--surface:\s*(#[0-9a-f]{6})/i)?.[1],
    dark: marked('pinned').match(/--surface:\s*(#[0-9a-f]{6})/i)?.[1],
  };
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  for (const name of names) {
    const value = series[name];
    if (!value) fail(`tokens.css: missing --${name} on :root`);
    else if (!/^#[0-9a-f]{6}$/i.test(value)) fail(`tokens.css: --${name} must be a #rrggbb colour (got ${value})`);
    else
      for (const [theme, surface] of Object.entries(surfaces)) {
        if (!surface) fail(`tokens.css: no #rrggbb --surface found for the ${theme} theme, so --${name} cannot be contrast-checked`);
        else if (contrast(value, surface) < 3) fail(`tokens.css: --${name} ${value} is under 3:1 against the ${theme} --surface ${surface}`);
      }
  }
}

// 3. components.css: one layer, one prefix.
const components = stripComments(sheets['packages/admin-css/components.css']).trim();
if (!components.startsWith('@layer ak {') || !components.endsWith('}')) {
  fail('components.css: every rule must sit inside one `@layer ak { … }` block');
} else {
  let depth = 0;
  const inner = components.slice('@layer ak {'.length, -1);
  for (const ch of inner) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) {
      fail('components.css: a rule closes the ak layer early');
      break;
    }
  }
}
const defined = new Set();
for (const [, name] of components.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
  if (/^\d/.test(name)) continue;
  if (!name.startsWith('ak-')) fail(`components.css: class .${name} lacks the ak- prefix`);
  defined.add(name);
}

// 4. Every ak- class admin-react emits exists.
const srcDir = join(root, 'packages/admin-react/src');
const reactSources = readdirSync(srcDir).map((file) => [file, readFileSync(join(srcDir, file), 'utf8')]);
for (const [file, source] of reactSources) {
  // Class names appear in string literals; `ak-stats-cols-${cols}` is checked per value below.
  for (const [, literal] of source.matchAll(/['"`]([^'"`]*\bak-[^'"`]*)['"`]/g)) {
    for (const [name] of literal.matchAll(/\bak-[a-z0-9-]+[a-z0-9]/g)) {
      if (name === 'ak-stats-cols' || name === 'ak-alert') continue;
      if (!defined.has(name)) fail(`admin-react/src/${file}: emits .${name}, which components.css does not define`);
    }
  }
}
// The phone rule the chart tests rely on: a chart 480px wide or less keeps only its major x labels.
let tickHidden = false;
for (const [header] of components.matchAll(/@container\s*\(\s*max-width:\s*(\d+(?:\.\d+)?)px\s*\)\s*\{/g)) {
  const width = Number(header.match(/max-width:\s*([\d.]+)px/)[1]);
  if (width > 480) continue;
  const start = components.indexOf(header) + header.length;
  let depth = 1;
  let end = start;
  while (depth > 0 && end < components.length) {
    if (components[end] === '{') depth++;
    if (components[end] === '}') depth--;
    end++;
  }
  for (const [, selectors, body] of components.slice(start, end - 1).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const listed = selectors.split(',').map((sel) => sel.trim());
    if (listed.includes('.ak-chart-tick-minor') && /(^|;)\s*visibility:\s*hidden\s*(;|$)/.test(body.trim())) tickHidden = true;
  }
}
if (!tickHidden) fail('components.css: missing a narrow-chart rule (@container max-width <= 480px) hiding .ak-chart-tick-minor');
for (const cols of [3, 4, 5]) if (!defined.has(`ak-stats-cols-${cols}`)) fail(`components.css: missing .ak-stats-cols-${cols}`);
for (const tone of ['danger', 'warning', 'info', 'success']) if (!defined.has(`ak-alert-${tone}`)) fail(`components.css: missing .ak-alert-${tone}`);

// 5. Public-package hygiene: no brands, app names or local paths in shipped files.
const shipped = [
  ...Object.entries(sheets),
  ['packages/admin-tokens/theme.js', read('packages/admin-tokens/theme.js')],
  ...reactSources.map(([file, source]) => [`packages/admin-react/src/${file}`, source]),
];
for (const [path, text] of shipped) {
  if (/data-brand/.test(text)) fail(`${path}: ships a per-app brand selector; apps set their own accent`);
  if (/\/home\/|\/Users\/|[A-Z]:\\\\/.test(text)) fail(`${path}: contains a local path`);
  if (/@(?!metaobjectsdev\/)[\w-]+\/admin-/.test(text)) fail(`${path}: names a package outside the @metaobjectsdev scope`);
}

// 6. tokens.json.
try {
  execFileSync(process.execPath, [join(root, 'scripts/tokens-json.mjs'), '--check'], { stdio: 'pipe' });
} catch (error) {
  fail(String(error.stderr || error.message).trim());
}

// 6b. tokens.json is DTCG: every leaf has $value and $type, and every alias points at a token.
{
  const dtcg = JSON.parse(read('packages/admin-tokens/tokens.json'));
  const types = new Set(['color', 'dimension', 'fontFamily', 'shadow']);
  const resolve = (path) => path.split('.').reduce((node, key) => node?.[key], dtcg);
  for (const [groupName, group] of Object.entries(dtcg)) {
    if (groupName.startsWith('$')) continue;
    for (const [name, leaf] of Object.entries(group)) {
      const where = `tokens.json: ${groupName}.${name}`;
      if (!('$value' in leaf)) fail(`${where} has no $value`);
      if (!types.has(leaf.$type)) fail(`${where} has an unknown $type ${leaf.$type}`);
      const alias = typeof leaf.$value === 'string' && leaf.$value.match(/^\{([^}]+)\}$/);
      if (alias && !resolve(alias[1])?.$value) fail(`${where} aliases ${alias[1]}, which does not exist`);
    }
  }
  const names = (group) => Object.keys(dtcg[group]).sort().join();
  if (names('light') !== names('dark')) fail('tokens.json: the light and dark groups define different tokens');
}
try {
  execFileSync(process.execPath, [join(root, 'scripts/build-admin-css.mjs'), '--check'], { stdio: 'pipe' });
} catch (error) {
  fail(String(error.stderr || error.message).trim());
}

// 6c. Package metadata a publish depends on.
{
  const manifests = ['tokens', 'css', 'react'].map((name) => [name, JSON.parse(read(`packages/admin-${name}/package.json`))]);
  const version = manifests[0][1].version;
  for (const [name, manifest] of manifests) {
    const where = `packages/admin-${name}/package.json`;
    if (manifest.name !== `@metaobjectsdev/admin-${name}`) fail(`${where}: name is ${manifest.name}`);
    if (manifest.version !== version) fail(`${where}: version ${manifest.version} differs from the other packages (${version})`);
    if (manifest.license !== 'Apache-2.0') fail(`${where}: license must be Apache-2.0`);
    if (manifest.private) fail(`${where}: must not be private`);
    if (manifest.publishConfig?.access !== 'public') fail(`${where}: publishConfig.access must be public`);
    if (manifest.publishConfig?.tag !== 'preview') fail(`${where}: publishConfig.tag must be preview until a 1.0 release`);
    if (manifest.publishConfig?.registry) fail(`${where}: publishConfig must not name a registry`);
    for (const dep of Object.keys(manifest.dependencies ?? {})) {
      if (!['@metaobjectsdev/admin-tokens', '@metaobjectsdev/admin-css'].includes(dep)) fail(`${where}: runtime dependency ${dep}; only the kit's own packages are allowed`);
    }
    for (const doc of ['LICENSE', 'NOTICE']) {
      if (read(`packages/admin-${name}/${doc}`) !== read(doc)) fail(`packages/admin-${name}/${doc} differs from the root ${doc}`);
      if (!manifest.files.includes(doc)) fail(`${where}: files must list ${doc}`);
    }
  }
  if (!manifests[1][1].exports['./admin.css']) fail('packages/admin-css/package.json: exports must include ./admin.css');
  if (!manifests[1][1].exports['./components.css']) fail('packages/admin-css/package.json: exports must include ./components.css');
  if (!manifests[2][1].peerDependencies?.react) fail('packages/admin-react/package.json: react must be a peer dependency');
}

// 7. The Tailwind bridge compiles.
// The fixture sits under node_modules so `@import "tailwindcss"` resolves from the workspace.
const cache = join(root, 'node_modules/.cache');
mkdirSync(cache, { recursive: true });
const work = mkdtempSync(join(cache, 'admin-kit-tw-'));
try {
  const input = join(work, 'input.css');
  writeFileSync(
    input,
    [
      '@layer theme, base, ak, components, utilities;',
      '@import "tailwindcss";',
      `@import "${join(root, 'packages/admin-tokens/tailwind.css')}";`,
      `@import "${join(root, 'packages/admin-css/components.css')}";`,
      '@source inline("bg-surface text-text-muted border-border bg-accent text-accent-fg text-danger-ink rounded-md shadow-pop font-display bg-viz-1 dark:bg-surface-2");',
      '',
    ].join('\n'),
  );
  const cli = join(root, 'node_modules/@tailwindcss/cli/dist/index.mjs');
  const out = execFileSync(process.execPath, [cli, '-i', input], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const expectations = [
    [/\.bg-surface\s*\{\s*background-color:\s*var\(--surface\)/, 'bg-surface → var(--surface)'],
    [/\.text-text-muted\s*\{\s*color:\s*var\(--text-muted\)/, 'text-text-muted → var(--text-muted)'],
    [/\.rounded-md\s*\{\s*border-radius:\s*var\(--r-md\)/, 'rounded-md → var(--r-md)'],
    [/\.bg-viz-1\s*\{\s*background-color:\s*var\(--viz-1\)/, 'bg-viz-1 → var(--viz-1)'],
    [/\.dark\\:bg-surface-2:where\(\[data-theme="dark"\]/, 'dark: keyed to [data-theme="dark"]'],
    [
      /\.dark\\:bg-surface-2:where\([^{]*\):not\(:where\(\[data-theme="dark"\] \[data-theme="light"\], \[data-theme="dark"\] \[data-theme="light"\] \*\)\)/,
      'dark: off inside a light scope nested in a dark one',
    ],
    [/prefers-color-scheme:\s*dark/, 'dark: keyed to the OS preference'],
    [/--bg:\s*#f6f7f9/, 'tokens.css imported'],
    [/\.ak-btn\s*\{/, 'components.css imported'],
  ];
  // The README's first line must keep the kit's layer below Tailwind's utilities.
  const order = out.match(/@layer ([\w-]+(?:, [\w-]+)+);/)?.[1].split(', ') ?? [];
  if (!(order.includes('ak') && order.indexOf('ak') < order.indexOf('utilities'))) {
    fail(`tailwind.css bridge: the ak layer must come before utilities (got ${order.join(', ') || 'no layer order'})`);
  }
  for (const [pattern, label] of expectations) if (!pattern.test(out)) fail(`tailwind.css bridge: expected ${label}`);
} catch (error) {
  fail(`tailwind.css bridge failed to compile: ${String(error.stderr || error.message).trim()}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  for (const message of failures) console.error(`✗ ${message}`);
  process.exit(1);
}
console.log(`CSS checks passed (${defined.size} ak- classes defined).`);
