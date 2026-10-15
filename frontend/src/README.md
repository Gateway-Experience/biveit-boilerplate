# Source layout

```
src/
  assets/            images, svgs
  components/
    shadui/          shadcn/ui primitives — GENERATED, do not hand-edit
    common/          our own composable components
    layouts/         page layouts (shell around <Outlet/>)
    pages/           routable pages
  data/              large static reference data
  routes/            route definitions
  services/          business/domain logic and API calls
  state-store/       zustand store
  styles/            global css + theme variables
  types/             shared TypeScript types (flat, one file per domain)
  utils/             generic helpers, hooks, constants
```

## Folder notes

### `components/shadui/` — generated, not ours
shadcn/ui primitives (`button`, `dialog`, `select`, …), added via `npx shadcn add <name>`.

- **Don't hand-edit.** Re-running the CLI overwrites these files.
- Excluded from eslint — they follow shadcn's own style (double quotes, no semicolons), not ours.
- They're still *our* files in the sense that we own them (shadcn copies rather than installs), so editing is allowed — just be aware an update will clobber it. Prefer wrapping in `common/`.
- The folder is named `shadui` rather than shadcn's default `ui` to make the generated/handwritten split obvious. `components.json` maps the `ui` alias here, so `shadcn add` still lands in the right place.

### `components/common/` — our composable components
Hand-written, reusable components that aren't pages or layouts (`Modal`, `Popover`, `FormField`, `AutoSuggestion`, …). Most wrap one or more `shadui` primitives and add the API we actually want.

Also holds the app-level providers (`AppProvider`, `ThemeProvider`, `NotificationProvider`) mounted in `main.jsx`.

### `components/pages/` — routable pages
One file per route. May have subfolders to group feature-related pages and their local-only components.

### `components/layouts/`
Shells that wrap pages via react-router's `<Outlet/>`.

### `data/`
Large static reference data that would drown a component if inlined (e.g. `vietnamCities.ts`, 443 lines). Data only — no logic. Types for it live in `types/`.

### `services/`
Business/domain logic and API calls. The place where backend shapes are interpreted.

### `types/`
Shared TypeScript types, **flat, split by filename** — `user.ts`, `city.ts`, etc.

- `ambient.d.ts` is different: global declarations (`*.css` side-effect imports, the untyped `react-image-gallery`). Not a domain type file.
- Types used in exactly one place can stay co-located in that file; move here once shared.

### `styles/`
One file, `index.css` — **pure CSS, no SCSS** (and no `sass` dependency; there never was one here).

Tailwind v4 moved config into CSS, so this file *is* the design system: `@import "tailwindcss"`, the `@theme` token map, and the `:root` / `.dark` palettes.

Everything SCSS used to be for is now native or Tailwind's job — variables → CSS custom properties (runtime, which is how dark mode works at all), nesting → native CSS nesting, mixins → utilities or `cva`, `darken()` → `oklch()` / `color-mix()`. Adding sass would cost a build step and give back `$variables` that can't respond to a theme switch.

**Rule:** every colour in our code is a theme token — no `bg-gray-100`, no `text-white`, no hex. If you need a new one, add it to `:root` + `.dark` and map it in `@theme inline`; don't hardcode it in a component. (`components/shadui/**` is exempt: it's generated.)

Deliberately-fixed colours get a token too, so they're visible to an audit rather than hiding as raw black. `--scrim` / `--scrim-strong` / `--scrim-foreground` are the overlay scrims: they stay dark in *both* themes on purpose, since a media lightbox that inverted in dark mode would be wrong.

A new colour, radius or spacing value goes in `@theme` as a CSS variable, not hardcoded in a component. That's what keeps per-project recoloring to one file.

#### Where does a given style go?

Four tiers, cheapest first. Always take the highest one that works.

**1. Design tokens — `styles/index.css`, `:root` / `.dark`**
Colors, the base radius, fonts. Changing `--primary` recolors every button, ring, link and chart at once, in both themes. This is the per-project customization knob.
```css
:root { --primary: oklch(0.55 0.21 258); }   /* brand blue */
.dark  { --primary: oklch(0.70 0.18 258); }  /* both, or dark mode breaks */
```

**2. Global element behaviour — `styles/index.css`, `@layer base`**
Rules that should hold everywhere regardless of component. The pointer-cursor-on-buttons rule lives here (shadcn's own `--pointer` option writes exactly this; `components.json` records `"pointer": true` so a future `init` keeps it):
```css
@layer base {
  button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
}
```
`@layer base` matters — it keeps these below utilities, so a `cursor-default` class can still win locally.

**3. Component-wide changes — wrap in `common/`, don't edit `shadui/`**
To change a primitive everywhere (a new Button variant, different default size), write a wrapper in `components/common/` and import that instead. Editing `shadui/` works but the next `shadcn add`/update overwrites it.

For a genuinely new *variant* (not a one-off), extending the `cva` block in the `shadui/` file is acceptable — just know it's the one edit that will be clobbered, so keep it small and easy to reapply.

**4. One-off page/component styling — Tailwind classes inline**
Spacing, layout, and anything specific to one screen. No CSS file, no CSS module.
```tsx
<div className='mt-4 flex flex-col gap-4 sm:flex-row'>
```
Use theme tokens rather than raw colors — `bg-muted`, `text-muted-foreground`, `border-border` — so it follows the theme and dark mode for free. Reach for `cn()` when merging conditional classes; it resolves Tailwind conflicts properly, unlike string concatenation.

#### Gotcha: shadcn variants assume a light surface

Every shadcn variant is written for a component sitting on `--background`. Put one on an inverted surface (our `bg-primary` navbar, a dark footer, a sidebar) and several defaults misfire at once:

| Default | On a dark surface |
|---|---|
| `hover:bg-muted` (ghost) | light block appears behind the text |
| `hover:text-foreground` (ghost) | text flips to near-black — nearly invisible |
| `focus-visible:border-ring` | near-white 1px border |
| `aria-invalid:border-destructive` | red border (Base UI toggles `aria-invalid` on some triggers) |

The focus/invalid ones are the sneaky pair: they only appear *after a click*, because focus persists, so they read as a random flicker rather than a style bug.

Overriding one and not the others is worse than overriding none — a background fix alone leaves black text on a dark bar. See `NAV_ITEM_CLASS` in `components/common/Navbar.tsx` for the full set.

Keep the focus indicator when you suppress the border — swap it for a ring (`focus-visible:ring-primary-foreground/40`) rather than removing it, or keyboard navigation breaks.

**Escape hatch:** truly dynamic values (a computed width, a background image URL) go in `style={{}}`, since Tailwind can't generate arbitrary runtime classes. `ImageThumbnailItem` does this for its `size` prop.

What we deliberately don't do: CSS modules, styled-components, or a second stylesheet per page. One global stylesheet for tokens, utilities everywhere else.

### `utils/`
Generic helpers with no domain knowledge — `hooks.js`, `request.js` (axios wrapper), `constants.js`, `common.js`, `i18nMappings.js`.

Rule of thumb vs. `services/`: if it knows about *our* backend or business rules, it's a service; if it would work in any app, it's a util.

## Analytics (Mixpanel)

Optional per project. Set `VITE_MIXPANEL_TOKEN` in `.env` to switch it on; leave it empty
and every function in `services/analytics.ts` is a no-op, so **call sites never need a
guard**.

```ts
import { useAnalytics } from 'src/utils/hooks';

const { trackEvent } = useAnalytics();
trackEvent('checkout_started', { plan: 'pro' });
```

`VITE_PROJECT_NAME` is registered as a mixpanel super property (`project`), so it rides
along on every event automatically — one mixpanel project can serve several apps built
from this boilerplate and you can still filter by which one sent what. Set it per project;
it's separate from `APP_NAME` in `utils/constants.ts`, which is the human-facing display
name used for things like the logo alt text.

Wired up already:
- `initAnalytics()` in `AppProvider`, alongside the other site-wide init
- `identifyUser()` on any change to the store's `user` — covers both the initial `/me` and a later login
- `resetAnalytics()` in `Navbar`'s `logout`, so the next person on this browser isn't merged into the previous profile. It re-registers the super properties afterwards — mixpanel's `reset()` clears persistence, and without that the `project` tag would quietly vanish from every event after the first logout
- `useTrackPageViews()` in `routes/index.tsx`, above `<Routes>` — react-router never does a full page load, so mixpanel's own `track_pageview` would only ever see the first one. It sits there rather than in a layout because `/`, `/dummy` and `/login` don't use `DefaultLayout`, and a layout-mounted hook would silently miss them

**Bundle cost:** `mixpanel-browser` is imported normally, which adds ~126 kB gzipped
(292 → 418 kB) to *every* project, used or not. Switching `services/analytics.ts` to a
dynamic `import()` keeps the main bundle at baseline and splits Mixpanel into a chunk
fetched only when a token exists — worth doing if bundle size starts to matter.

## Starting a new project from this boilerplate

```bash
./scaffold.sh /abs/path/to/new-project          # names the package after the folder
./scaffold.sh /abs/path/to/app --name my-app    # or name it explicitly
```

Copies `src/`, the configs, `public/`, `.env` and `node_modules`, and renames the package.
It refuses a relative path, a non-empty target (unless `--force`), or the boilerplate itself.

`node_modules` comes along by default so the new project runs offline straight away. It's
~479MB / 34k files, which makes it the slow part (~3.4s vs ~2.7s for `npm ci` on a warm
cache) — close enough that copying is the friendlier default. Pass `--install` to run
`npm ci` instead, which is worth doing if the two projects might drift onto different
dependency versions.

`dist/`, `.git/` and `*.tsbuildinfo` are deliberately left behind: the new project should
start with its own history and a clean build.

Afterwards: `git init`, set `VITE_API_BASE_URL` in `.env`, and recolor the tokens in
`styles/index.css`.

## Checks

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` over `src` |
| `npm run lint` | eslint, **report only** |
| `npm run lint:fix` | eslint with `--fix` |
| `npm run check` | typecheck + lint — the one to run before pushing |
| `npm run build` | typechecks **then** bundles |

**Why `build` runs `tsc` first:** Vite strips types with esbuild/SWC without checking them, so `vite build` alone succeeds on code `tsc` rejects. The typecheck is what makes a broken build fail.

`lint` deliberately does not `--fix`. A check command that rewrites your files is a bad default; use `lint:fix` when you want that.

### TypeScript setup
- `tsconfig.json` — references only; `tsconfig.app.json` covers `src`, `tsconfig.node.json` covers `vite.config.ts`.
- `strict: true`, `allowJs: false`. The whole of `src` is TypeScript; a new `.js` file can't be imported from TS.
- **TS 7 vs typescript-eslint**: the linter has no TS 7 support yet ([#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)), so `package.json` uses the TS team's side-by-side aliases — `npx tsc` runs 7.x, the linter sees the TS 6 API. Collapse this to a plain `typescript` dep once support lands.

### ESLint setup
Flat config (`eslint.config.js`), TS parsed via `@typescript-eslint/parser`.
- `src/components/shadui/**` is ignored — generated, and follows shadcn's style not ours.
- `no-unused-vars` is off in favour of `@typescript-eslint/no-unused-vars`; the base rule miscounts type-signature parameters.
- `Memoizer.tsx` disables `react-hooks/exhaustive-deps` — it calls `useCallback` inside a `map` (the component's whole purpose), which *crashes* that rule rather than warning.

Not set up: pre-commit hooks and CI. Worth adding `npm run check` to both when this becomes a real project.

## Conventions

- **Path alias is `src/*`**, not shadcn's default `@/*` — e.g. `import Modal from 'src/components/common/Modal'`.
- **`cn`** is imported from the `cn` npm package directly (`import { cn } from 'cn'`), not from a local `lib/utils`. shadcn scaffolds `src/lib/utils.ts` as a re-export; it was deleted as dead code.
- **`react-router`**, never `react-router-dom` — `BrowserRouter` comes from `react-router` and the two packages have separate contexts.
- **TypeScript**: new code is `.tsx`/`.ts`. Some older files are still `.jsx`/`.js` (`allowJs` is on, `checkJs` is off), so mixing is fine during the transition.

## Still JavaScript

`main.jsx`, `routes/index.jsx`, `state-store/index.js`, `services/user.js`, `utils/*.js`, and `components/common/{AppProvider,Memoizer}.jsx`, `components/pages/{Home,Dummy,UserProfile}.jsx`.

Converting `services/user.js` and `state-store/index.js` is where the `User` type in `types/user.ts` starts paying off.
