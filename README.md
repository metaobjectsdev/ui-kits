# MetaObjects UI kits

Reusable UI kits for [MetaObjects](https://metaobjects.dev) models. Generated forms and grids
import a kit as their default component map, and an app can use a kit on its own.

| Kit | Folder | Packages | Status |
|---|---|---|---|
| Admin | [`kits/admin`](kits/admin) | `@metaobjectsdev/admin-tokens`, `@metaobjectsdev/admin-css`, `@metaobjectsdev/admin-react` | preview (`0.1.0`, npm tag `preview`) |

Each kit is self-contained: it has its own workspace, lockfile, checks and version, and does not
import from another kit. Work inside a kit's folder; its README has the install, usage and
publish instructions.

## License

[Apache-2.0](LICENSE).
