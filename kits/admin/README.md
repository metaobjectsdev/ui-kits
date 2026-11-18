# MetaObjects admin kit

Shared admin UI kit: design tokens, plain-CSS components and React components. One look
for every admin screen, light and dark, phone first, and safe under a `default-src 'none'`
content policy (no web fonts, no images, no `url()`).

| Package | What it holds | Use it from |
|---|---|---|
| [`@metaobjectsdev/admin-tokens`](packages/admin-tokens) | `tokens.css` (CSS custom properties, light and dark), `tokens.json` (W3C Design Tokens format), `tailwind.css` (Tailwind 4 bridge), `theme.js` (the theme contract) | every stack, including server-rendered pages |
| [`@metaobjectsdev/admin-css`](packages/admin-css) | `admin.css` (tokens and components in one file, no bundler needed) and `components.css`: every component as plain CSS in `@layer ak`, all classes prefixed `ak-` | any page, React or not |
| [`@metaobjectsdev/admin-react`](packages/admin-react) | React 19 components that emit the `ak-` classes; no Tailwind dependency | React apps |

`admin-react` depends on `admin-css`, which depends on `admin-tokens`, so a React app
installs one package and gets all three.

Open [`demo/index.html`](demo/index.html) with `pnpm demo` to see the components in light
and dark, under the strict content policy. [`demo/data.html`](demo/data.html) shows the
layout and data components.

## Install

Public preview: all three packages publish together under the npm `preview` dist-tag, not
`latest`, until one outside adopter has run the kit. `pnpm add @metaobjectsdev/admin-react@preview`
(or `npm install`, `bun add`) installs it. A plain `npm install @metaobjectsdev/admin-react`
asks for `latest`, which does not exist until a release is promoted.

```sh
pnpm add @metaobjectsdev/admin-react@preview   # React apps (brings admin-css and admin-tokens)
pnpm add @metaobjectsdev/admin-css@preview     # plain-CSS pages (brings admin-tokens)
pnpm add @metaobjectsdev/admin-tokens@preview  # tokens only: CSS custom properties and tokens.json
```

Needs Node 22 or later to build; React apps need React 19 (a peer dependency, the only one).

## Use

**React, no Tailwind.** Load the two stylesheets once, then use the components:

```ts
import '@metaobjectsdev/admin-tokens/tokens.css';
import '@metaobjectsdev/admin-css/components.css';
import { initTheme } from '@metaobjectsdev/admin-react';

initTheme(); // apply the stored theme before the first render
```

**Tailwind 4.** The bridge loads the tokens, maps them to theme values (`bg-surface`,
`text-text-muted`, `border-border`, `bg-accent`, `text-danger-ink`, `rounded-md`, …) and keys
`dark:` to the theme contract, so existing `dark:` classes keep working while an app moves
to tokens:

```css
@layer theme, base, ak, components, utilities;
@import "tailwindcss";
@import "@metaobjectsdev/admin-tokens/tailwind.css";
@import "@metaobjectsdev/admin-css/components.css";
```

The first line puts the kit's `ak` layer below Tailwind's utilities, so `className="p-0"`
on a `Card` or `w-1/2` on an `ak-input` wins. Without it the `ak` layer is declared last
and beats every utility.

One known limit: a dark scope inside a light scope inside a dark scope gets no `dark:`
utilities. The tokens still theme it correctly.

**Plain HTML or server-rendered pages.** Link `@metaobjectsdev/admin-css/admin.css` (or the two
files it joins, or a vendored copy) and write the markup the demo shows. `@metaobjectsdev/admin-tokens/theme.js` is a dependency-free ES module with the
same theme helpers the React package uses.

The kit styles only elements that carry `ak-` classes, plus `.ak-root` (the shell adds it).
It does not reset `body`; give the page `body { margin: 0 }` or put `class="ak-root"` on
`<body>` to paint the page background as well.

## Using with MetaObjects

The kit is the MetaObjects reference admin kit: generated forms and grids import it as their
default component map. It has three layers, and a renderer picks the ones its stack can use.

| Layer | Package | Holds | Who uses it |
|---|---|---|---|
| 1. Tokens | `@metaobjectsdev/admin-tokens` | `tokens.css` (CSS custom properties, light and dark), `tokens.json` ([DTCG](https://www.designtokens.org/) format), `tailwind.css`, `theme.js` | every stack |
| 2. CSS | `@metaobjectsdev/admin-css` | `admin.css` (tokens plus components in one file) or `components.css` (components only): every component as plain CSS, classes prefixed `ak-` | every stack: server-rendered pages, Angular, a static preview renderer, React |
| 3. React | `@metaobjectsdev/admin-react` | React 19 components that emit the `ak-` classes, from one entry, with their prop types | React stacks |

**A non-React stack uses layers 1 and 2 only.** It links one stylesheet and writes the `ak-`
markup itself; it needs no JavaScript and no bundler:

```html
<link rel="stylesheet" href="/node_modules/@metaobjectsdev/admin-css/admin.css">
```

`admin.css` is `tokens.css` followed by `components.css` (generated, and checked against both in
CI). Link it alone; do not also load the two parts. A renderer that is not CSS at all reads the
tokens from `@metaobjectsdev/admin-tokens/tokens.json`, a Design Tokens Community Group file:
groups `base` (type, radii, sizes, the chart series palette), `light` and `dark` (colours per
theme) and `coarsePointer` (touch sizes), each token a `{ "$value", "$type" }` leaf named for its
CSS custom property without the `--`. Where the CSS text is not the same bytes as the DTCG value
(an `rgba()` colour, a shadow), `$extensions["dev.metaobjects.admin-kit"].css` keeps the original.

**A React stack** imports the stylesheet once and the components from the package entry:

```tsx
import '@metaobjectsdev/admin-css/admin.css';
import { Field, inputClass, Button, Table, Th, Td, Section, type FieldProps } from '@metaobjectsdev/admin-react';
```

`@metaobjectsdev/admin-react` has one entry, `.`, and everything exported from it is public API:
a renamed export or a removed prop is a breaking change (see Versioning). The pieces a generated
form or grid uses, with the prop types each exports:

| Generated UI | Component or class helper | Props type |
|---|---|---|
| Form section | `Section` (title, description, actions), `Card` | `SectionProps`, `CardProps` |
| Field with label, hint, error | `Field` (binds label, hint and error to one control) | `FieldProps`, `FieldControlProps` |
| Text input, select, textarea | `inputClass`, `selectClass`, `textareaClass` on the native element, inside a `Field` | none: the native element's own props |
| Choice of a few values | `SegmentedControl` | `SegmentedControlProps`, `SegmentedOption` |
| Reference or lookup | `LookupPicker` | `LookupPickerProps`, `LookupOption` |
| File | `FileInput` | `FileInputProps` |
| Button | `Button`, `buttonClass(variant, size)` | `ButtonProps`, `ButtonVariant`, `ButtonSize` |
| Inline-edited cell | `InlineEditCell` | `InlineEditCellProps` |
| Read-only value | `Value`, `DefinitionList` | `ValueProps`, `DefinitionItem` |
| Static table | `Table`, `Th`, `Td`, `EmptyRow` | `TableProps`, `ThProps`, `TdProps`, `EmptyRowProps` |
| Data grid | `DataTable` (columns, paging, selection, CSV) | `DataTableProps`, `DataColumn` |
| Generated `EntityGrid` | `entityGridClasses` (class names, no component) | none |
| Status and empty states | `Badge`, `Alert`, `ErrorText`, `Loading`, `Skeleton`, `EmptyState` | `BadgeProps`, `AlertProps`, `ErrorTextProps`, `LoadingProps`, `SkeletonProps`, `EmptyStateProps` |
| Confirm and toast | `ConfirmDialog`, `useConfirm`, `ToastProvider`, `useToast` | `ConfirmDialogProps`, `ToastOptions` |

React is a peer dependency (`react` and `react-dom`, `^19`). The only other runtime dependencies
are the kit's own CSS and token packages.

### The `ak-` class reference

Every rule is in one cascade layer, `ak`, and every class starts with `ak-`, so the kit never
collides with an app's own classes and any unlayered app rule wins over it. A `-x` below is a
modifier written `ak-<base>-x`. Components with state use ARIA attributes, not state classes:
`aria-current="page"` on an active nav item, `aria-pressed` on a segmented button.

| Area | Classes |
|---|---|
| Root | `ak-root` (page background, text and type scale; put it on `<body>` or the app root), `ak-num` (tabular figures), `ak-muted`, `ak-faint`, `ak-sr-only`, `ak-right` |
| Shell | `ak-shell`, `ak-sidebar`, `ak-sidebar-inner`, `ak-brand`, `ak-nav`, `ak-nav-group`, `ak-nav-label`, `ak-nav-item` (`ak-nav-sub`), `ak-count`, `ak-sidebar-foot`, `ak-main`, `ak-content`, `ak-scrim`, `ak-shell-topbar`, `ak-topbar`, `ak-tabbar`, `ak-tab-btn`, `ak-chips`, `ak-chip`. Below 1024px the rail is a drawer: `data-nav-open` on `.ak-shell` opens it |
| Page | `ak-page-head`, `ak-page-title`, `ak-page-desc`, `ak-page-back`, `ak-actions`, `ak-section` (`-head`, `-title`, `-desc`), `ak-card` (`-head`, `-title`, `-body`, `-foot`), `ak-stats` (`-cols-3`, `-cols-4`, `-cols-5`), `ak-stat` (`-label`, `-value`, `-value-sm`, `-note`) |
| Controls | `ak-btn` (`-primary`, `-ghost`, `-quiet`, `-quiet-danger`, `-danger`, `-danger-solid`, `-sm`, `-icon`), `ak-seg` (`-danger`, `ak-seg-count`) |
| Forms | `ak-form`, `ak-form-row`, `ak-field`, `ak-label`, `ak-hint`, `ak-error-text`, `ak-input`, `ak-select`, `ak-textarea`, `ak-check` |
| Status | `ak-badge` (`-success`, `-warning`, `-danger`, `-info`, `-accent`, `-plain`, `-realm`), `ak-dot`, `ak-alert` (`-info`, `-warning`, `-danger`, `-success`) |
| Tables | `ak-table-wrap`, `ak-table`, `ak-tr`, `ak-empty-row`, `ak-wrap`, `ak-list`, and for a generated `EntityGrid`: `ak-grid-head`, `ak-grid-cell`, `ak-grid-search`, `ak-grid-pager` |
| States | `ak-empty` (`ak-empty-calm`, `-icon`, `-title`, `-text`, `-action`), `ak-skel`, `ak-skel-stack`, `ak-loading` |
| Overlays | `ak-dialog` (a native `<dialog>` opened with `showModal()`; `ak-dialog-reaches`, `ak-dialog-factor`), `ak-drawer` (`-panel`, `-head`, `-body`, `-foot`), `ak-toasts`, `ak-toast` |
| Values | `ak-value`, `ak-unknown`, `ak-money` (`-notional`, `-negative`), `ak-link`, `ak-link-btn`, `ak-multiline`, `ak-copy`, `ak-dl` (`-group`, `-row`, `-wide`) |
| Filters | `ak-filterbar`, `ak-filter`, `ak-period` (`ak-period-stepper`) |
| Data table | `ak-dtable` (`-bar`, `-bulk`, `-group`, `-row`, `-pager`), `ak-menu`, `ak-menu-list`, `ak-menu-item` |
| Editing | `ak-iedit`, `ak-lookup`, `ak-file` |
| Navigation | `ak-palette`, `ak-queue`, `ak-kbd` |
| Charts | `ak-chart` (`-head`, `-legend`, `-key`, `-toggle`, `-body`, `-y`, `-svg`, `-x`, `-tick-minor`, `-bar`, `-line` (`ak-chart-line-dashed`), `-dot`, `-gap`, `-hit`, `-table`, `-export`, `-s1` to `-s6`, `-s-other`), `ak-sparkline` (`ak-sparkline-bar`, `ak-spark-line`, `ak-spark-bar`), `ak-meter` (`-inline`, `-warning`, `-danger`, `-stale`) |

Touch screens (`pointer: coarse`) get 44px controls and 16px inputs. [`demo/index.html`](demo/index.html)
and [`demo/data.html`](demo/data.html) show the markup for each of these, light and dark. The
detail for each package is in its own README.

## Theme contract

One rule for every app:

- `<html data-theme="light">` or `<html data-theme="dark">` pins the theme. With no
  attribute the page follows `prefers-color-scheme`.
- The user's choice is stored under one key, **`admin-theme`** (`light` or `dark`; no key
  means auto), and every read and write is wrapped in `try/catch`. `readTheme()`,
  `setTheme()`, `applyTheme()` and `initTheme()` implement this. `setTheme()` fires
  `admin-theme-change` on `window`; `ThemeToggle` and `useTheme()` share one store over it,
  so every toggle on a page agrees, and they follow changes made in other tabs. Server
  rendering shows `auto` until hydration reads the stored choice.
- Theme scopes carry colours only. Type, radii, control heights and `--font-display` sit
  on `:root` alone, so a nested scope keeps the app's display font and the touch sizes.
- Any element may carry `data-theme` to start a nested scope, such as a dark panel on a
  light page. The tokens restate `color: var(--text)` on every scope, because `color`
  inherits as a resolved value and would otherwise keep the outer theme's text colour.

## Setting an app's accent

Apps differ by accent only, plus an optional display font. The packages ship one default
accent. An app sets its own in its own CSS, **loaded after `tokens.css` and not inside a
cascade layer** (layered rules lose to the unlayered tokens). Restate it for all three
theme cases:

```css
/* Light, and the default before any theme applies. */
:root,
[data-theme="light"] {
  --accent: #0f766e;      /* fills: primary buttons, focus rings */
  --accent-fg: #ffffff;   /* text on --accent */
  --accent-ink: #0f766e;  /* accent-coloured text on surfaces: links, active nav */
  --accent-soft: #e0f2f1; /* tinted backgrounds: active nav, accent badges */
}

/* Pinned dark. */
[data-theme="dark"] {
  --accent: #2dd4bf;
  --accent-fg: #0b1513;
  --accent-ink: #5eead4;
  --accent-soft: rgba(45, 212, 191, 0.14);
}

/* Auto mode on a dark OS. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --accent: #2dd4bf;
    --accent-fg: #0b1513;
    --accent-ink: #5eead4;
    --accent-soft: rgba(45, 212, 191, 0.14);
  }
}

/* Optional: a display face for the brand mark and page titles. The app ships the font
   itself (and allows it in its content policy); the kit never loads fonts. */
:root {
  --font-display: "Your Display Face", Georgia, serif;
}
```

Check the contrast of `--accent-fg` on `--accent` and of `--accent-ink` on `--surface` and
`--accent-soft` in both themes (4.5:1 for text).

## React components

The API follows the admin kit it was extracted from, so moving an app over is mostly a
change of import path.

| Area | Exports |
|---|---|
| Shell | `AdminShell` (grouped rail on desktop, top bar and drawer over a scrim on phones), `NavGroup`, `NavItem`, `navItemClass(active)` |
| Page | `PageHeader`, `Section`, `Card` (`title`, `actions`, `footer`, `padded`), `cardClass`, `StatGrid`, `StatCard` |
| Controls | `Button` and `buttonClass(variant, size)` with `primary`, `secondary`, `ghost`, `danger`, `dangerSolid`, `quiet`, `quietDanger`; `SegmentedControl`; `inputClass`, `selectClass`, `textareaClass` |
| Forms | `Field`: label above, bound to its control (`htmlFor`/`id`), hint and error bound by `aria-describedby`, `aria-invalid` on error. Pass one control element, or a function that receives the binding props. |
| Status | `Badge` (text plus a dot, never colour alone), `Alert`, `ErrorText`, `Loading`, `Skeleton` (still under `prefers-reduced-motion`) |
| Empty | `EmptyState` with `kind="no-data"` (nothing here or nothing matches) or `kind="all-clear"` (calm: everything is handled) |
| Tables | `Table` (scrolls inside its card, never the page), `Th`, `Td` (`num`, `wrap`), `trClass`, `EmptyRow`, `entityGridClasses` |
| Overlays | `ConfirmDialog` on native `<dialog>.showModal()`, `useConfirm()` (a promise-based `window.confirm`), `ToastProvider`, `useToast()`, `Toast` (with Undo; the auto-close timer pauses while the toast is hovered or has focus) |
| Theme | `ThemeToggle`, `useTheme`, `initTheme`, `readTheme`, `setTheme`, `applyTheme`, `THEME_STORAGE_KEY`, `THEME_CHANGE_EVENT` |
| Charts | `BarChart` (`stacked`), `LineChart` (a series with `compare` is dashed), `ChartTable` (the "Show as table" form), `Sparkline`, `Meter`. The rules every chart keeps are in [`packages/admin-react/README.md`](packages/admin-react/README.md#charts). |
| Values | `Value` (one view per kind: text, number, boolean, code, money, date, timestamp, badge, reference, url, multiline; see the rules below), `Unknown`, `CopyValue`, `DefinitionList` (`items` or titled `groups`); helpers `formatMoney`, `sumMoney` (refuses mixed currencies or billed with notional), `formatUtcDay`, `formatExactUtc`, `formatRelative`, `safeHref`, `isUnknown` |
| Side sheet | `Drawer`: a modal side sheet, full screen under 640px; traps Tab, closes on Esc, the backdrop or Close (not while `busy`), and returns focus to its opener |
| Filters | `FilterBar` (sticky, with Clear filters), `FilterField`, `FilterSearch` (debounced, Enter commits), `FilterSegment` (with counts), `FilterSelect`; `PeriodControl` (presets, month stepper, custom dates, compare with the previous period) and `usePeriodParam`; helpers `resolvePeriod`, `previousRange`, `encodePeriod`, `decodePeriod` |
| Address state | `useUrlParams`, `useUrlParam`, `UrlStateProvider` with `searchParamsAdapter` (default, `?a=1` and `history`) or `hashParamsAdapter` (`#/page?a=1`), or your own `UrlAdapter`; no router dependency |
| Data table | `DataTable`: columns rendered through `Value`, stacked `label: value` rows under 640px, grouping, pager (client or server), row-action `ActionMenu`, bulk selection with bulk actions (a client table counts only selected rows still in `rows`; a server-paged table keeps every selected id across pages and passes them with the selected rows currently loaded, and the page clears the selection when its query or filter changes), CSV export (`toCsv`, RFC 4180, formula cells escaped, an inline error and `csv.onExportError` when the fetch fails), loading, error with Retry and empty states |
| Editing | `InlineEditCell` (saves on blur or Enter when changed, Esc cancels, locked until its load is ready, so it never saves over a failed or pending load), `LookupPicker` (async combobox, latest search wins), `FileInput` (image by default, type and size checked) |
| Navigation | `CommandPalette` (opens on `/` or Ctrl/⌘K, static items plus async search), `QueueLayout` (list plus the focused item; j/k move, 1–9 run actions, then it advances), `ActionMenu` |
| Tiered confirm | `ConfirmDialog` takes `tier` (0–3) and `exception`, which set an open dialog's strength: tier 3 keeps Confirm disabled until a second-factor code is entered. `useTieredConfirm()` is the way to apply the tier rule: tiers 0–1 resolve with no dialog, tier 2 (or an exception) asks, tier 3 also asks for a second-factor code. `confirmationFor()` is the same rule as a function |

Replacing `window.confirm`:

```tsx
const [confirm, confirmDialog] = useConfirm();

async function revoke() {
  if (!(await confirm({ title: 'Revoke access?', message: 'They lose the program at once.', confirmLabel: 'Revoke' }))) return;
  await revokeAccess();
  toast({ message: 'Access revoked', undo: restoreAccess });
}

return <>{/* page */}{confirmDialog}</>;
```

A generated MetaObjects `EntityGrid` takes class names rather than components:

```tsx
<div className="ak-card ak-table-wrap">
  <EntityGrid {...entityGridClasses} emptyState={<EmptyState title="No subscribers yet" />} />
</div>
```

Value rules (`Value`, `DefinitionList`, `DataTable` cells): an unknown value (null, empty,
`NaN`, an invalid date) shows `—` with "unknown" for screen readers, never `0` or a blank;
money is formatted from its currency (major or minor units), never mixes currencies or billed
and notional amounts in one sum, and marks a notional amount as not billed; numbers align
right in tabular figures; a date is a UTC day, and a timestamp shows relative time with the
exact UTC time on hover; a badge always has text; an external link opens in a new tab with
`rel="noopener noreferrer nofollow"`, and only `http` and `https` links become links.

Test ids: components take `data-testid` and derive their parts from it: rows
`<id>.row` with `data-row-id`, cells `<id>.<field>`, actions `<id>.action.<name>`, states
`<id>.empty`, `<id>.error` and `<id>.loading`. Name the page `<page>`, a block
`<page>.<block>`, a filter `<page>.filter.<field>` and the period control `<page>.period`.

Hosts that test `ConfirmDialog` need a jsdom stand-in for `showModal()`, and a page root inside
`AdminShell` must not set its own width or `min-width`. See
[`packages/admin-react/README.md`](packages/admin-react/README.md).

## Vendor a commit

A consumer that takes the kit as files rather than from the registry packs one commit:

```sh
scripts/pack-vendor.sh <out-dir>
```

It needs a clean working tree, builds the three packages and writes
`admin-tokens-<sha7>.tgz`, `admin-css-<sha7>.tgz` and `admin-react-<sha7>.tgz` (with `dist/`)
to `<out-dir>`. Pointing the consumer's `package.json` at them is the consumer's job.

## Versioning

Semver, with the tokens, the `ak-` classes and the exports of `@metaobjectsdev/admin-react` as the
public API. The `0.x` releases are previews (npm tag `preview`); `1.0.0` follows the first outside
adopter. Until then a minor release may still break, and the changelog says so. From `1.0.0`:

- **patch**: a fix that changes no token and no class.
- **minor**: a new token, class or component, or a changed token **value**.
- **major**: a token, class or exported component renamed or removed, or a component prop removed or
  changed incompatibly.

All three packages move together and share one version number.

## Develop

Run these from `kits/admin`.

```sh
pnpm install
pnpm check      # CSS guards, typecheck, tests, build
pnpm demo       # http://127.0.0.1:4310/demo/ (and demo/data.html for the layout and data components)
```

`pnpm check:css` runs the static guards for the CSS packages: the content policy, the token
and chart-palette rules, the `ak-` prefix and layer, class coverage, public-package hygiene,
`tokens.json` freshness (`pnpm tokens:json` regenerates it) and the Tailwind bridge. The list
of what fails, and why, is in the header of [`scripts/check-css.mjs`](scripts/check-css.mjs).

## Publish

For maintainers. Publish from `kits/admin` in a clean checkout of `main`, after the change has
merged, logged in to npm (`npm login`) as a member of the `metaobjectsdev` organisation with 2FA.
Tag the release `admin-v<version>`.

```sh
pnpm install --frozen-lockfile && pnpm check
pnpm -r publish --no-git-checks
```

The `publishConfig` of each package sets `access: public` and the dist-tag `preview`, so the
command needs no flags and does not move `latest`. `pnpm -r publish` publishes in dependency
order (tokens, css, react), rewrites the `workspace:^` ranges to real versions, and builds
`admin-react` first through its `prepack` script. Use pnpm, not npm: npm would publish the
`workspace:` ranges unchanged. Before publishing, `pnpm -r publish --dry-run --no-git-checks`
(or `npm pack --dry-run` in each package) lists what each tarball holds. Check afterwards:

```sh
npm view @metaobjectsdev/admin-react dist-tags
```

All three packages move together and share one version number. Move a release to `latest` only
after an outside adopter has used it: `npm dist-tag add @metaobjectsdev/admin-react@<version> latest`
for each package.

## License

[Apache-2.0](LICENSE). See [NOTICE](NOTICE).
