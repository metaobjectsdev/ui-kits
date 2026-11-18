# @metaobjectsdev/admin-react

The shared admin components for React 19. They render the `ak-` classes of
`@metaobjectsdev/admin-css` (installed with this package) and have no Tailwind dependency.

```ts
import '@metaobjectsdev/admin-tokens/tokens.css';
import '@metaobjectsdev/admin-css/components.css';
import { AdminShell, NavGroup, navItemClass, PageHeader, Card, Field, inputClass, ThemeToggle, initTheme } from '@metaobjectsdev/admin-react';

initTheme();
```

`@metaobjectsdev/admin-css/admin.css` holds the tokens and the components in one file, so one
import can replace the first two. React 19 is a peer dependency; the only other runtime
dependencies are the kit's CSS and token packages. The package has one entry, `.`, and every
export of it, with each component's props type (`CardProps`, `FieldProps`, `TableProps`, …), is
public API that MetaObjects' generated forms and grids build on: a rename or a removed prop is a
breaking change. `inputClass`, `selectClass` and `textareaClass` are class names for the native
elements inside a `Field`. The mapping from generated UI to components is in the root README,
"Using with MetaObjects". This is a preview release (npm tag `preview`).

| Area | Exports |
|---|---|
| Shell | `AdminShell` (grouped rail on desktop; top bar and drawer over a scrim on phones, closed by Esc, the scrim or a link), `NavGroup`, `NavItem`, `navItemClass(active)` |
| Page | `PageHeader`, `Section`, `Card`, `cardClass`, `StatGrid`, `StatCard` |
| Controls | `Button`, `buttonClass(variant, size)`, `SegmentedControl`, `inputClass`, `selectClass`, `textareaClass` |
| Forms | `Field`: label bound to its control, hint and error bound by `aria-describedby` |
| Status | `Badge`, `Alert`, `ErrorText`, `Loading`, `Skeleton` |
| Empty | `EmptyState` with `kind="no-data"` or `kind="all-clear"` |
| Tables | `Table`, `Th`, `Td`, `trClass`, `EmptyRow`, `entityGridClasses` (for a MetaObjects `EntityGrid`) |
| Overlays | `ConfirmDialog` (native `<dialog>.showModal()`), `useConfirm()`, `ToastProvider`, `useToast()`, `Toast` with Undo |
| Theme | `ThemeToggle`, `useTheme`, `initTheme`, `readTheme`, `applyTheme`, `THEME_STORAGE_KEY` (`admin-theme`) |
| Charts | `BarChart` (`stacked`), `LineChart` (a series with `compare` is dashed), `ChartTable`, `Sparkline`, `Meter`; data rules `isGap`, `checkChartUnits`, `foldSeries`, `chartDomain`, `chartCsv`, `xTicks` |
| Values | `Value`, `Unknown`, `CopyValue`, `DefinitionList`, `formatMoney`, `sumMoney`, `formatRelative`, `safeHref` |
| Side sheet | `Drawer` (full screen on phones, focus trap, Esc) |
| Filters | `FilterBar`, `FilterSearch`, `FilterSegment`, `FilterSelect`, `PeriodControl`, `usePeriodParam` |
| Address state | `useUrlParams`, `useUrlParam`, `UrlStateProvider`, `searchParamsAdapter`, `hashParamsAdapter` |
| Data table | `DataTable` (phone rows, grouping, pager, row menu, bulk selection, CSV), `ActionMenu`, `toCsv`, `csvCell`, `downloadCsv`. Bulk actions receive `{ ids, rows }`: every selected id (across pages when server-paged; a client table drops ids no longer in `rows`), plus the selected rows currently loaded. A failed CSV fetch shows an inline error and calls `csv.onExportError` |
| Editing | `InlineEditCell`, `LookupPicker`, `FileInput` |
| Navigation | `CommandPalette`, `QueueLayout` |
| Tiered confirm | `ConfirmDialog` `tier`/`exception`, `useTieredConfirm()`, `confirmationFor()` |

`useConfirm()` replaces `window.confirm`:

```tsx
const [confirm, confirmDialog] = useConfirm();
if (!(await confirm({ title: 'Revoke access?', confirmLabel: 'Revoke' }))) return;
// render {confirmDialog} once in the page
```

Testing a host that renders `ConfirmDialog`: jsdom has no `HTMLDialogElement.showModal()` or
`close()`, so add a stand-in to the test setup file:

```ts
const proto = HTMLDialogElement.prototype;
if (typeof proto.showModal !== 'function') {
  proto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  proto.show = proto.showModal;
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    setTimeout(() => this.dispatchEvent(new Event('close')), 0);
  };
}
```

`AdminShell` puts your page inside `.ak-content`, a grid whose direct children get
`min-width: 0`, so a single page root no longer widens the page on phones. Wide content still needs
its own scroll container (`Table` provides one) and the root must not set its own width or
`min-width`.

### Charts

Four kinds and no others: bar, line, sparkline and meter. They are inline SVG with no chart
library, no `url()` and no inline styles, so they render under a strict content policy, server
side included.

```tsx
<BarChart
  title="Revenue by program"
  unit="USD"
  format={usd}
  stacked
  rows={[{ key: '2026-10', label: 'Oct', values: { web: 4200, shop: null } }]}
  series={[{ key: 'web', label: 'Web' }, { key: 'shop', label: 'Shop' }]}
  data-testid="sales.revenue"
/>
```

The rules every chart keeps:

- **A missing point is a gap, never zero.** `null`, `undefined` or a non-finite number breaks a
  line, and draws a dashed mark where a bar would be. The table shows "—".
- **One unit per chart.** A series whose `unit` differs from the chart's makes it refuse to draw
  (an `Alert` whose message carries `data-error="mixed-units"`). A generator calls
  `checkChartUnits(unit, series)` first and gets `{ ok: false, code: 'mixed-units', units }` back.
- **At most six series.** More fold into the five largest and "Other" (`foldSeries`).
- **One palette, light and dark**: the `--series-*` tokens.
- **"Show as table"** swaps the drawing for `ChartTable`, built from the same rows. The table is
  also the accessible form (screen readers get it in both views) and its CSV export: the table
  view has an "Export CSV" button (`.action.export`, file name from `csvFilename` or the title)
  that downloads what `chartCsv` writes, the same rows and Total column, a gap as an empty cell.
- **Hover** shows the x label and every series' value (an SVG `<title>`; no pointer handling).

Test ids follow the block id passed as `data-testid`: `<id>.action.table` (the toggle),
`<id>.row` with `data-row-id`, `<id>.<series key>` (cells), `<id>.empty` and `<id>.error`.
`Sparkline` and `Meter` take the cell or tile id; with no reading they render "—", not a zero.

Peer dependencies: `react` and `react-dom` ^19.
