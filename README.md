# Wayfarer

A web app that renders **code tours** straight from a GitHub repository.

Give it a link to a tour JSON file in a repo and it fetches the tour, pulls the
referenced source files, syntax-highlights them, and lays the stops out as a
readable, scrollable page.

## Usage

```
npm install
npm run dev      # serves on http://localhost:8000
```

Open the app with a `?tour=` parameter pointing at a tour file's **GitHub blob
URL**:

```
http://localhost:8000?tour=https://github.com/owner/repo/blob/main/path/to/tour.json
```

Raw URLs (`https://raw.githubusercontent.com/...`) are accepted too. The repo
must be public (files are fetched anonymously from `raw.githubusercontent.com`).

## Tour format

A tour is a JSON file:

```json
{
  "title": "My Tour",
  "description": "Optional markdown intro.",
  "externalRepository": "https://github.com/owner/repo/tree/<commit>",
  "stops": [
    {
      "title": "Stop title",
      "content": "Markdown body for this stop (required).",
      "file": "src/foo.ts",
      "line": 10,
      "endLine": 25
    }
  ]
}
```

| Field                | Where | Meaning                                                          |
| -------------------- | ----- | ---------------------------------------------------------------- |
| `title`              | tour  | Tour heading (required).                                         |
| `description`        | tour  | Optional markdown intro shown before the stops.                 |
| `externalRepository` | tour  | Optional `github.com/owner/repo[/tree/ref]`; see below.         |
| `stops`              | tour  | Ordered list of stops (required).                                |
| `title`              | stop  | Stop heading (required).                                         |
| `content`            | stop  | Markdown body, GFM supported (required).                         |
| `file`               | stop  | File to display (optional; relative to the tour file's dir).     |
| `line`               | stop  | 1-based start line to emphasize (optional).                     |
| `endLine`            | stop  | 1-based end line to emphasize (defaults to `line`).             |

Relative `file` paths (including `../`) resolve against the directory the tour
file lives in, so tours are self-contained and portable within a repo. Set
`externalRepository` and the stop `file` paths instead resolve from the **root of
that repo**, letting a tour hosted in one repo explore a different one (pin a
commit SHA with `/tree/<sha>` so line numbers don't drift). A stop with no `file`
is a prose-only stop.

The [`examples/`](examples) directory has working tours: a self-tour of this repo
([`tour.json`](examples/tour.json)) plus tours of external projects
([`rust-os.json`](examples/rust-os.json),
[`vscodevim.json`](examples/vscodevim.json), [`ds4.json`](examples/ds4.json)).

**Writing a tour?** See [`AUTHORING.md`](AUTHORING.md) for the full format
reference and advice on putting together a good tour — it's also the file to
point an agent at when generating one.

## How it works

1. Parse the `?tour=` blob URL → `owner`, `repo`, `branch`, path, and the tour's
   base directory (`src/github.ts`).
2. Fetch the tour JSON from `raw.githubusercontent.com` and validate it
   (`src/types.ts`).
3. For each stop with a `file`, resolve the path, fetch the raw file, and
   highlight it with [Shiki](https://shiki.style) (`src/highlight.ts`,
   `src/Stop.tsx`).

## Stack

React + Vite + TypeScript, [react-markdown](https://github.com/remarkjs/react-markdown)
with GFM, and Shiki for syntax highlighting. No backend — everything runs in the
browser against GitHub's public raw endpoint.
