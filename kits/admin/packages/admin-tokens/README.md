# @metaobjectsdev/admin-tokens

The shared admin design tokens as CSS custom properties, light and dark, with no web
fonts, images or `url()`, so they pass a `default-src 'none'` content policy.

| File | What it is |
|---|---|
| `tokens.css` | Surfaces, borders, text, accent, status colours, effects, a five-colour chart palette, the `--series-*` palette the charts use (six slots and a grey "Other", the same in light and dark), type sizes, radii, control heights, and the rail and drawer widths |
| `tailwind.css` | Tailwind 4 bridge: imports the tokens, maps them to theme values and keys `dark:` to the theme contract |
| `tokens.json` | The same values in the [W3C Design Tokens (DTCG)](https://www.designtokens.org/) format, for renderers that are not CSS: groups `base`, `light`, `dark` and `coarsePointer`, each token a `{ "$value", "$type" }` leaf named for its CSS custom property without the `--` (types `color`, `dimension`, `fontFamily`, `shadow`; `font-display` is the alias `{base.font-sans}`). Generated from `tokens.css` |
| `theme.js` | The theme contract as a tiny ES module: `readTheme`, `setTheme`, `applyTheme`, `initTheme`, `THEME_STORAGE_KEY`, and `THEME_CHANGE_EVENT`, which `setTheme` fires on `window` |

```css
@import "@metaobjectsdev/admin-tokens/tokens.css";
/* or, in a Tailwind 4 app: */
@import "tailwindcss";
@import "@metaobjectsdev/admin-tokens/tailwind.css";
```

**Theme contract.** `<html data-theme="light|dark">` pins the theme; with no attribute the
page follows `prefers-color-scheme`. The user's choice lives under the `admin-theme`
storage key. Any element may carry `data-theme` to start a nested scope; a scope carries
colours only, so type, radii and control sizes stay as `:root` sets them.

**Accent.** One default accent ships. An app sets its own `--accent`, `--accent-fg`,
`--accent-ink` and `--accent-soft` (and optionally `--font-display`) in its own unlayered
CSS loaded after this file, for `:root, [data-theme="light"]`, for `[data-theme="dark"]`
and for `:root:not([data-theme="light"])` inside `@media (prefers-color-scheme: dark)`.

**Versioning.** A changed token value is a minor release; a renamed or removed token is a
major one.
