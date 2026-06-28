# Authoring Wayfarer tours

A guide for writing **code tours** that Wayfarer can render. It covers the JSON
format in full and the craft of putting a good tour together. If you are an
agent generating a tour for a human, read this start to finish first.

## What a tour is

A tour is a single JSON file that tells a linear story through a codebase. It is
an ordered list of **stops**; each stop is a chunk of prose paired (usually) with
a range of lines in a source file. Wayfarer fetches the file from GitHub,
syntax-highlights it, and renders the stops top-to-bottom as one scrollable page.

A tour is for *reading*, not *running*. Think of it as the narrated walkthrough a
senior engineer would give a new hire: "start here, this is the entry point; now
look at this, here's the trick; the rest of this function handles edge cases."

## The JSON format

```json
{
  "title": "string (required)",
  "description": "optional markdown intro",
  "externalRepository": "optional https://github.com/owner/repo[/tree/ref]",
  "stops": [
    {
      "title": "string (required)",
      "content": "markdown body (required)",
      "file": "path/to/source.ts",
      "line": 27,
      "endLine": 38
    }
  ]
}
```

### Top-level fields

| Field                | Required | Type   | Meaning |
| -------------------- | -------- | ------ | ------- |
| `title`              | yes      | string | Tour heading, shown at the top and in the header bar. |
| `description`        | no       | string | Markdown intro rendered before the first stop. Use it to set context: what the project is, what thread the tour follows, any caveats. |
| `externalRepository` | no       | string | A `github.com/owner/repo` URL. When set, stop `file` paths resolve against the **root of that repo** instead of the tour file's own directory. See [Pointing at another repo](#pointing-at-another-repo). |
| `stops`              | yes      | array  | Ordered list of stops. An empty array is valid but pointless. |

### Stop fields

| Field     | Required | Type   | Meaning |
| --------- | -------- | ------ | ------- |
| `title`   | yes      | string | Stop heading. |
| `content` | yes      | string | The prose for this stop. Markdown with GitHub-flavored extensions (tables, fenced code, task lists, autolinks). |
| `file`    | no       | string | Source file to display. A stop with no `file` is a prose-only stop (good for intros, transitions, or section dividers). |
| `line`    | no       | number | 1-based line to start emphasizing. Omit it and the **whole file** is shown with nothing emphasized. |
| `endLine` | no       | number | 1-based last line to emphasize, inclusive. Defaults to `line` (a single-line emphasis). |

Validation is strict on the required fields and types (`parseTour` in
`src/types.ts` throws human-readable errors), but it does **not** check that
files exist or that line numbers are in range — a bad path or out-of-range line
fails only at render time. Get them right yourself.

## How file paths resolve

This is the part that most often goes wrong, so be deliberate.

- **Default (no `externalRepository`):** a stop's `file` is resolved **relative
  to the directory the tour JSON lives in**, within the same repo. If the tour
  is at `examples/tour.json`, then `file: "../src/github.ts"` points at
  `src/github.ts`. `.` and `..` segments are collapsed; a leading `/` means
  "from the repo root." `../` that would climb above the repo root is dropped.
- **With `externalRepository`:** every stop `file` resolves from the **root of
  that repo**, regardless of where the tour file itself lives. So
  `file: "kernel/src/main.rs"` is just that path from the repo root. This is what
  lets a tour hosted in one repo explore a completely different repo.

Either way, paths use forward slashes and the referenced repo must be **public**
(files are fetched anonymously from `raw.githubusercontent.com`).

### Pointing at another repo

`externalRepository` accepts these shapes:

```
https://github.com/owner/repo
https://github.com/owner/repo/tree/main
https://github.com/owner/repo/tree/<commit-sha>
```

With no `/tree/<ref>`, Wayfarer fetches `HEAD` (the default branch).

**Pin to a commit SHA, not a branch**, whenever you can. Line numbers are
hand-maintained and brittle: if the tour points at a branch and someone pushes to
it, every `line`/`endLine` in your tour can silently drift onto the wrong code.
Pinning to a `/tree/<full-sha>` freezes the tour against exactly the code you
wrote it for. The bundled examples (`examples/rust-os.json`,
`examples/vscodevim.json`, `examples/ds4.json`) all pin a SHA — follow that.

For a tour of its *own* repo (no `externalRepository`), the tour is fetched from
the branch in the `?tour=` blob URL, so pin that URL to a tag or SHA for the same
reason if stability matters.

## Line numbers and the displayed snippet

- `line`/`endLine` are **1-based and inclusive**. `line: 27, endLine: 38` shows
  lines 27 through 38 emphasized.
- Wayfarer tokenizes a small lead-in **above** your range (for correct
  highlighting context) but does **not** display it — the reader sees exactly
  your `line..endLine` window, with the option to expand to the full file.
- Choose ranges that frame **one coherent idea**: a whole function, a struct
  definition, the body of a match arm. Ranges that start or end mid-expression
  read badly.
- You can reference code just outside the window in your prose ("the loop below",
  "the trait declared just above") — the reader can expand to see it. This is a
  good way to keep the emphasized snippet tight while still gesturing at context.

## Writing a good tour

The format is easy; the writing is the work. What separates a good tour from a
pile of code excerpts:

**Follow a single thread.** A tour is a narrative, not a file index. Pick one
question and answer it end to end — "how does a keystroke become a command,"
"how does the kernel boot and run a process," "what is the public API and how is
it wired." Every stop should move that thread forward. Resist the urge to cover
everything; cover *one path* well.

**Order for understanding, not for the filesystem.** Sequence stops the way a
person should learn the system: entry point first, then the core mechanism, then
the supporting pieces, then a concrete end-to-end example. Don't just walk files
alphabetically or top-to-bottom.

**Make each stop earn its place.** A stop should reveal something the reader
couldn't guess from the previous one. If two adjacent stops say the same kind of
thing, merge them or cut one. Aim for the smallest set of stops that tells the
whole story — often 5–12 for a focused tour.

**Explain *why*, not *what* the code says.** The reader can see the code. Your
prose should add what the code can't: the intent, the non-obvious constraint, the
trick, the thing that would bite someone who changed it. "This is a bump
allocator; `dealloc` does nothing because the kernel allocates once and runs
forever" is worth reading. "This function allocates memory" is not.

**Anchor prose to the snippet.** Name the specific functions, types, and
variables visible in the window. Point up and down ("the `TODO` below admits
this is wasteful," "the enum above is the contract both sides agree on"). This
ties the words to the code and makes the snippet feel navigated, not just quoted.

**Keep snippets tight.** Emphasize the lines that matter and lean on the prose
plus the expand affordance for the rest. A 60-line emphasized block is usually a
sign the stop is trying to do too much.

**Use prose-only stops for structure.** A stop with no `file` is a clean way to
open the tour, mark a transition between sections, or summarize before diving in.

**Set the stage in `description`.** One or two paragraphs: what the project is,
what thread this tour follows, and any caveat the reader needs up front (e.g.
"line numbers track `main` at the time of writing and may drift").

**Write self-contained content.** Don't rely on the reader having clicked
"expand" or having read GitHub in another tab. Each stop should make sense from
its emphasized snippet plus your words.

## A minimal complete example

```json
{
  "title": "Foo: how requests get routed",
  "description": "Foo is a tiny HTTP router. This tour follows one request from the socket to a handler.",
  "externalRepository": "https://github.com/example/foo/tree/abc123def456",
  "stops": [
    {
      "title": "Where requests come in",
      "content": "Every request lands in `serve`. It reads the request line, then hands off to `route` — the rest of this function is just connection bookkeeping.",
      "file": "src/server.rs",
      "line": 40,
      "endLine": 58
    },
    {
      "title": "Matching a path to a handler",
      "content": "`route` walks the registered routes in order and returns the first whose pattern matches. Note it's linear — fine for a handful of routes, and the `TODO` below knows it.",
      "file": "src/router.rs",
      "line": 12,
      "endLine": 31
    }
  ]
}
```

## Checklist before publishing

- [ ] `title` and every stop's `title` and `content` are present.
- [ ] Every `file` path resolves correctly (relative to the tour dir, or to the
      external repo root if `externalRepository` is set).
- [ ] `externalRepository` is pinned to a commit SHA, not a moving branch.
- [ ] Every `line`/`endLine` matches the code at that pinned ref and frames a
      coherent unit.
- [ ] The referenced repo(s) are public.
- [ ] The stops read as one continuous story, in a deliberate order.
- [ ] It is valid JSON.

To preview, host the file on GitHub and open Wayfarer with its blob URL:

```
http://localhost:8000/?tour=https://github.com/owner/repo/blob/main/path/to/tour.json
```

### Previewing without pushing to GitHub

Pushing to a public repo on every edit is a slow authoring loop. The `?tour=`
parameter accepts **any URL**, not just a GitHub one, so you can serve the tour
JSON from your own machine and iterate against a hosted Wayfarer instance
without running the app yourself.

1. Add `externalRepository` to your tour pointing at the public repo whose
   source files the stops reference. This is **required** when the tour isn't
   loaded from GitHub — that's the only thing telling Wayfarer where the source
   files live. (Source files still come from GitHub; only the tour JSON is
   local.)
2. Serve the tour file's directory locally with CORS enabled, e.g.
   `npx serve --cors` or `npx http-server --cors`.
3. Open the hosted app with a `?tour=` pointing at your local server:

   ```
   https://wayfarer.example.com/?tour=http://localhost:3000/tour.json
   ```

Now editing `tour.json` and reloading the page shows the change immediately — no
commit, no push. Two constraints on the server: it must send CORS headers
allowing the Wayfarer origin (the `--cors` flags above do this), and it must be
`https` or `localhost` (browsers block plain-`http` fetches from an `https`
page, but exempt `localhost`).
