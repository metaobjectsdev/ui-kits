# @metaobjectsdev/admin-css

The shared admin components in plain CSS. Every rule sits in one cascade layer, `ak`, and
every class starts with `ak-`, so the kit never collides with an app's own class names,
and any unlayered app rule wins over it. No web fonts, images or `url()`: it passes a
`default-src 'none'` content policy.

```html
<link rel="stylesheet" href="/node_modules/@metaobjectsdev/admin-css/admin.css">
```

`admin.css` is the tokens and the components in one self-contained file, so a page or renderer
with no bundler needs only this one link. To load them separately (or to vendor them):

```html
<link rel="stylesheet" href="/vendor/admin-tokens/tokens.css">
<link rel="stylesheet" href="/vendor/admin-css/components.css">
```

Do not load `admin.css` together with the two parts. Both entries are in the package's
`exports` map: `@metaobjectsdev/admin-css/admin.css` and `@metaobjectsdev/admin-css/components.css`.

or, through a bundler:

```css
@import "@metaobjectsdev/admin-tokens/tokens.css";
@import "@metaobjectsdev/admin-css/components.css";
```

In a Tailwind 4 app, name the layer order before importing Tailwind, so utilities such as
`p-0` or `w-1/2` on an `ak-` element win over the kit:

```css
@layer theme, base, ak, components, utilities;
@import "tailwindcss";
@import "@metaobjectsdev/admin-tokens/tailwind.css";
@import "@metaobjectsdev/admin-css/components.css";
```

What it covers:

- **Shell**: `ak-shell`, `ak-sidebar` / `ak-sidebar-inner`, `ak-brand`, `ak-nav` with
  `ak-nav-group`, `ak-nav-label`, `ak-nav-item` (`aria-current="page"`, `ak-nav-sub`,
  `ak-count`), `ak-sidebar-foot`, `ak-main`, `ak-content`. Below 1024px the rail becomes a
  drawer: put `data-nav-open` on `.ak-shell` to open it over `.ak-scrim`, and show the
  `.ak-shell-topbar` menu button. Also `ak-topbar`, `ak-tabbar` / `ak-tab-btn` and
  `ak-chips` / `ak-chip` for bottom-tab phone layouts.
- **Page**: `ak-page-head`, `ak-page-title`, `ak-page-desc`, `ak-actions`, `ak-section`,
  `ak-card` (`-head`, `-title`, `-body`, `-foot`), `ak-stats` (`ak-stats-cols-3|4|5`), `ak-stat`.
- **Controls**: `ak-btn` (`-primary`, `-ghost`, `-quiet`, `-quiet-danger`, `-danger`,
  `-danger-solid`, `-sm`, `-icon`), `ak-seg` with `aria-pressed` buttons (`ak-seg-danger`).
- **Forms**: `ak-form`, `ak-form-row`, `ak-field`, `ak-label` (always above, always bound),
  `ak-hint`, `ak-error-text`, `ak-input`, `ak-select`, `ak-textarea`, `ak-check`.
- **Status**: `ak-badge` (text plus a dot; `-success`, `-warning`, `-danger`, `-info`,
  `-accent`, `-plain`, `-realm`), `ak-count`, `ak-dot`, `ak-alert` (`-info`, `-warning`,
  `-danger`, `-success`).
- **Data**: `ak-table-wrap` + `ak-table` (scrolls inside its card), `ak-list` rows,
  `ak-grid-*` for a generated grid's class-name props.
- **States**: `ak-empty` (no data) and `ak-empty ak-empty-calm` (all clear), `ak-skel`
  (still under `prefers-reduced-motion`), `ak-loading`.
- **Overlays**: `ak-dialog` for a native `<dialog>` opened with `showModal()`, `ak-toasts`
  region with `ak-toast`.
- **Charts**: `ak-chart` (a container: labels thin out and the plot shortens at 480px wide or
  less) with `ak-chart-head`, `ak-chart-legend` / `ak-chart-key`, `ak-chart-toggle`,
  `ak-chart-body`, `ak-chart-y`, `ak-chart-svg`, `ak-chart-x` (`ak-chart-tick-minor`), SVG marks
  `ak-chart-bar`, `ak-chart-line` (`-dashed`), `ak-chart-dot` (a lone reading, undashed even on a
  dashed line), `ak-chart-gap` (a dashed "no reading" mark), `ak-chart-hit`, series slots
  `ak-chart-s1` to `-s6` and `ak-chart-s-other`, `ak-chart-table`, and `ak-chart-export` (the
  table view's "Export CSV" button). `ak-sparkline`
  (`ak-sparkline-bar` for the bar form; `ak-spark-line`, `ak-spark-bar`), `ak-meter` (`-inline`,
  `-warning`, `-danger`, `-stale`) and `ak-unknown` (the "—" of a missing value). Colours come
  from the `--series-*` tokens, which are the same in light and dark.
- **Values**: `ak-value`, `ak-unknown`, `ak-num`, `ak-money` (`-notional`, `-negative`),
  `ak-link`, `ak-link-btn`, `ak-multiline`, `ak-copy`, `ak-dl` (`-group`, `-row`, `-wide`).
- **Side sheet**: `ak-drawer` on a native `<dialog>` (`-panel`, `-head`, `-body`, `-foot`);
  `min(var(--drawer-w), 100vw)` wide, full screen under 640px.
- **Filters**: `ak-filterbar` (sticky), `ak-filter`, `ak-period` with `ak-period-stepper`,
  `ak-seg-count`.
- **Data table**: `ak-dtable` with `ak-dtable-bar`, `-bulk`, `-group`, `-row`, `-pager`;
  under 640px each row stacks as `label: value` lines from the cells' `data-label`.
  `ak-menu` / `ak-menu-list` / `ak-menu-item` for the row-action menu.
- **Editing**: `ak-iedit`, `ak-lookup`, `ak-file`.
- **Navigation**: `ak-palette`, `ak-queue` (list and focused item side by side from 1024px,
  the item first below), `ak-kbd`.
- **Tiered confirm**: `ak-dialog-reaches`, `ak-dialog-factor`.

Touch screens (`pointer: coarse`) get 44px controls and 16px inputs, so iOS does not zoom.
