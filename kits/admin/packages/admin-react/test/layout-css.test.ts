// Documented exception to the test-quality rule: these tests read the CSS source instead of
// executing an interface. jsdom does not lay out and the kit has no browser test harness, so
// no observable layout behaviour exists to assert; the demo page shows these layouts in a real
// browser. Each assertion pins its declaration inside one named selector's block, so a rule in
// another selector cannot satisfy it.
import { readFileSync } from 'node:fs';

// Vitest runs in packages/admin-react.
const css = readFileSync(`${process.cwd()}/../admin-css/components.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = readFileSync(`${process.cwd()}/../admin-tokens/tokens.css`, 'utf8');

/** The bodies of every `@media (<query>) { … }` block, joined. */
function media(query: string): string {
  const out: string[] = [];
  let at = css.indexOf(`@media (${query})`);
  while (at >= 0) {
    let depth = 0;
    const start = css.indexOf('{', at);
    for (let i = start; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) {
        out.push(css.slice(start + 1, i));
        break;
      }
    }
    at = css.indexOf(`@media (${query})`, at + 1);
  }
  return out.join('\n').replace(/\s+/g, ' ');
}

const phone = media('max-width: 639.98px');

describe('phone width (under 640px, so 390px)', () => {
  it('opens the drawer full screen', () => {
    expect(phone).toMatch(/\.ak-drawer \{[^}]*width: 100vw;/);
    expect(css).toMatch(/\.ak-drawer \{[^}]*width: min\(var\(--drawer-w\), 100vw\)/);
    expect(tokens).toMatch(/:root \{[^}]*--drawer-w: 480px;/);
  });

  it('stacks table rows as "label: value" lines with the header hidden', () => {
    expect(phone).toMatch(/\.ak-dtable-table thead \{[^}]*position: absolute;/);
    expect(phone).toMatch(/\.ak-dtable-table, \.ak-dtable-table tbody, \.ak-dtable-table tr, \.ak-dtable-table td[^{]*\{ display: block;/);
    expect(phone).toMatch(/\.ak-dtable-table td::before \{[^}]*content: attr\(data-label\);/);
    // Row actions stay in the menu, pinned to the row's corner.
    expect(phone).toMatch(/td\.ak-dtable-actions \{[^}]*position: absolute;/);
  });

  it('puts the palette near the top with the full height available', () => {
    expect(phone).toMatch(/\.ak-palette \{[^}]*margin-top: 8px;/);
  });
});

describe('queue layout', () => {
  it('shows the focused item first when stacked, and beside the list from 1024px', () => {
    expect(css).toMatch(/\.ak-queue-detail \{[^}]*order: -1;[^}]*\}/);
    expect(media('min-width: 1024px')).toMatch(/\.ak-queue-panes \{[^}]*grid-template-columns: minmax\(260px, 340px\) minmax\(0, 1fr\);[^}]*\}/);
  });

  it('keeps a closed menu list hidden although it is a grid', () => {
    expect(css).toMatch(/\.ak-menu-list\[hidden\] \{[^}]*display: none;[^}]*\}/);
  });
});
