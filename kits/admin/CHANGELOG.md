# Changelog

All three packages share one version number. Releases before `1.0.0` are previews, published
under the npm `preview` dist-tag.

## 0.1.0

First public release, as the MetaObjects reference admin kit.

- Packages `@metaobjectsdev/admin-tokens`, `@metaobjectsdev/admin-css` and
  `@metaobjectsdev/admin-react`, licensed Apache-2.0.
- `@metaobjectsdev/admin-tokens`: CSS custom properties for light and dark (`tokens.css`),
  `tokens.json` in the W3C Design Tokens (DTCG) format, a Tailwind 4 bridge (`tailwind.css`) and
  the theme contract helper (`theme.js`). The `--series-*` chart palette is the same in light and
  dark.
- `@metaobjectsdev/admin-css`: every component as plain CSS in one cascade layer (`ak`), all classes
  prefixed `ak-`. New stable entry `admin.css`: tokens and components in one file, for pages and
  renderers with no bundler; `components.css` is still exported.
- `@metaobjectsdev/admin-react`: React 19 components that emit the `ak-` classes, from one entry
  with a props type for each component: shell, page, controls and `Field`, status, tables,
  `DataTable`, filters and period control, URL state, inline editing, lookup and file inputs,
  `Value` and `DefinitionList`, `Drawer`, `ConfirmDialog` with tiers, toasts, command palette,
  queue layout, and bar, line, sparkline and meter charts. React is a peer dependency.
- README: "Using with MetaObjects" covers the three layers, which layer a non-React stack uses, and
  the `ak-` class reference.
- `scripts/pack-vendor.sh <out-dir>` packs the three packages at a commit, for a consumer that
  vendors the kit as files.
