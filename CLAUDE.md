# CLAUDE.md

Guidance for working in this repo.

## What this is

Wayfarer is a client-only web app that renders **code tours** from a GitHub
repository. You give it a GitHub blob URL to a tour JSON file via a `?tour=`
query parameter; it fetches the tour and the source files it references,
syntax-highlights them, and renders the stops as a stacked, scrollable page.

There is no backend. Files are fetched anonymously from
`raw.githubusercontent.com`, so **only public repos work**.

## Commands

```bash
npm install
npm run dev      # Vite dev server on http://localhost:8000 (port set in vite.config.ts)
npm run build    # tsc -b type-check + vite production build
npm run preview  # serve the production build
```

There is no test runner or linter configured. `npm run build` is the
type-check/CI gate — keep it green.

## Architecture / data flow

1. `App.tsx` reads `?tour=` and calls `parseBlobUrl` (`github.ts`) to derive
   `{owner, repo, branch, path, baseDir}` from the GitHub blob (or raw) URL.
2. It fetches the tour JSON from `raw.githubusercontent.com` and validates it
   with `parseTour` (`types.ts`), which throws human-readable errors.
3. Each `Stop.tsx` renders its markdown `content` and, if the stop names a
   `file`, fetches that file (path resolved relative to the tour's `baseDir`
   via `resolvePath`), tokenizes it with `highlightLines` (`highlight.ts`),
   and renders it line-by-line in `CodeView`.

## Key files

- `src/github.ts` — URL parsing + path resolution. `parseBlobUrl` accepts both
  `github.com/.../blob/...` and `raw.githubusercontent.com/...`. `resolvePath`
  joins a stop's relative `file` against `baseDir`, collapsing `.`/`..`; a
  leading `/` means repo-root. Pure functions — easy to test directly with Node
  (`node --experimental-strip-types` / Node 24 strips types) by importing the
  `.ts` with absolute paths.
- `src/types.ts` — `Tour`/`TourStop` types and `parseTour` runtime validation.
- `src/highlight.ts` — Shiki tokenization. Returns structured `CodeLine[]`
  (not an HTML blob) so the UI can slice snippets and control per-line layout.
  Uses **dual themes**; each token carries both `light` and `dark` colors.
- `src/Stop.tsx` — stop rendering + the `CodeView` snippet/expand logic.
- `src/theme.ts` — `useTheme` hook, synced to `<html data-theme>` + localStorage.
- `src/index.css` — all styling; theme palette as CSS variables.

## Tour JSON format

```json
{
  "title": "string (required)",
  "description": "optional markdown intro",
  "externalRepository": "optional https://github.com/owner/repo[/tree/branch]",
  "stops": [
    {
      "title": "string (required)",
      "content": "markdown body (required)",
      "file": "path relative to the tour file's directory (optional)",
      "line": 10,
      "endLine": 25
    }
  ]
}
```

When `externalRepository` is set, stop `file` paths resolve relative to the
**root of that repo** (not the tour file's directory), so a tour hosted in one
repo can explore an unrelated repo. With no branch in the URL we fetch `HEAD`
(the default branch). `App.tsx` derives a separate `fileLoc` for stop fetches
via `parseRepoUrl`; the tour JSON itself is still fetched from its own repo.

`examples/tour.json` is a working tour of this repo's own source. Its stop
`line`/`endLine` values are hand-maintained and will drift if the referenced
files change — update them when editing those files.

## Conventions and gotchas

- **Raw fetches use `{ cache: "no-cache" }`** (`App.tsx`, `Stop.tsx`). GitHub's
  raw endpoint sends `cache-control: max-age=300`; without revalidation the
  browser serves an edited tour stale for up to 5 minutes. Keep this.
- **Theme switching is CSS-only.** Tokens render with inline
  `{ "--cl": light, "--cd": dark }`; `index.css` selects the active one via
  `.codeline span { color: var(--cl) }` and
  `:root[data-theme="dark"] .codeline span { color: var(--cd) }`. Toggling the
  theme does not re-highlight.
- **No-flash theme boot.** An inline script in `index.html` sets
  `data-theme` before first paint from localStorage / `prefers-color-scheme`.
  `useTheme` reads that initial value — keep the two in sync.
- **Snippet highlight only when expanded.** Collapsed, every visible line is the
  snippet, so `CodeView` suppresses the highlight band; it appears only in the
  expanded view to distinguish focus lines from context.
- **Blank lines** get a `min-height` in `.codeline` so a highlighted empty line
  renders a continuous band rather than a zero-height gap.
- Shiki bundles grammars per-language via dynamic import, so the build warns
  about large per-language chunks — expected, they load on demand.

## Visual verification

The build only type-checks. For UI changes, verify in a real browser against
the live example tour:
`http://localhost:8000/?tour=https://github.com/hgoldstein95/wayfarer/blob/main/examples/tour.json`
(Playwright/Chromium driven from a scratchpad dir works well for screenshots.)
