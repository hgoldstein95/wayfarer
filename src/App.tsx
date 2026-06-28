import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseRepoUrl, parseTourUrl, type RepoLocation } from "./github";
import { parseTour, type Tour } from "./types";
import { Stop } from "./Stop";
import { useTheme } from "./theme";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tour: Tour; fileLoc: RepoLocation };

export function App() {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const tourUrl = new URLSearchParams(window.location.search).get("tour");
    if (!tourUrl) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      try {
        const loc = parseTourUrl(tourUrl);
        // Revalidate rather than trust GitHub's 5-min raw cache, so an edited
        // tour shows up on reload instead of being served stale.
        const res = await fetch(loc.fetchUrl, { cache: "no-cache" });
        if (!res.ok) {
          throw new Error(
            `Could not fetch tour file (HTTP ${res.status}). Check the URL and that the repo (or server) is public.`,
          );
        }
        const json = JSON.parse(await res.text());
        const tour = parseTour(json);
        // Stop files normally resolve against the tour's own repo, but a tour
        // can name an `externalRepository` to explore a different repo instead.
        // A tour served from a non-GitHub URL has no repo of its own, so it
        // must declare externalRepository to say where its files live.
        const fileLoc = tour.externalRepository
          ? parseRepoUrl(tour.externalRepository)
          : loc.repo;
        if (!fileLoc) {
          throw new Error(
            'This tour was loaded from a non-GitHub URL, so it must set "externalRepository" to a public github.com/owner/repo URL so its source files can be found.',
          );
        }
        if (!cancelled) setState({ status: "ready", tour, fileLoc });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <a className="app__brand" href="?">
          Wayfarer
        </a>
        {state.status === "ready" && (
          <span className="app__tour-title">{state.tour.title}</span>
        )}
        <button
          className="app__theme-toggle"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>

      <main className="app__main">
        {state.status === "idle" && <Landing />}
        {state.status === "loading" && <p className="notice">Loading tour…</p>}
        {state.status === "error" && (
          <div className="notice notice--error">
            <strong>Couldn’t load the tour.</strong>
            <p>{state.message}</p>
          </div>
        )}
        {state.status === "ready" && (
          <article className="tour">
            <h1 className="tour__title">{state.tour.title}</h1>
            {state.tour.description && (
              <div className="tour__intro markdown">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {state.tour.description}
                </Markdown>
              </div>
            )}
            <ol className="tour__stops">
              {state.tour.stops.map((stop, i) => (
                <Stop key={i} stop={stop} index={i} loc={state.fileLoc} />
              ))}
            </ol>
          </article>
        )}
      </main>
    </div>
  );
}

const REPO = "https://github.com/hgoldstein95/wayfarer";

const EXAMPLES = [
  {
    file: "examples/tour.json",
    title: "Wayfarer: a quick self-tour",
    blurb: "A tour of this app’s own source — the shortest way to see the idea.",
  },
  {
    file: "examples/rust-os.json",
    title: "A 1,000-line RISC-V kernel in Rust",
    blurb: "Boot, virtual memory, processes, and syscalls in a tiny OS.",
  },
  {
    file: "examples/vscodevim.json",
    title: "How a keystroke becomes a Vim command",
    blurb: "One thread through VSCodeVim, from key event to action.",
  },
  {
    file: "examples/ds4.json",
    title: "A native DeepSeek V4 inference engine",
    blurb: "antirez’s self-contained C inference engine, end to end.",
  },
];

/** In-app link that opens a tour given its GitHub blob URL. */
function tourHref(file: string): string {
  return `?tour=${encodeURIComponent(`${REPO}/blob/main/${file}`)}`;
}

function Landing() {
  const example =
    "?tour=https://github.com/owner/repo/blob/main/path/to/tour.json";
  return (
    <div className="landing">
      <h1>Wayfarer</h1>
      <p>
        Wayfarer renders <strong>code tours</strong> straight from a GitHub
        repository: a guided, narrated walk through a codebase, laid out as one
        readable, scrollable page. There’s no backend — it fetches the tour and
        the source files it references from GitHub and syntax-highlights them in
        your browser.
      </p>
      <p>
        Point it at a tour file by appending a <code>?tour=</code> parameter with
        the tour JSON’s GitHub blob URL:
      </p>
      <pre className="landing__example">
        <code>{example}</code>
      </pre>

      <h2>Try an example</h2>
      <ul className="landing__examples">
        {EXAMPLES.map((ex) => (
          <li key={ex.file}>
            <a className="landing__example-link" href={tourHref(ex.file)}>
              <span className="landing__example-title">{ex.title}</span>
              <span className="landing__example-blurb">{ex.blurb}</span>
            </a>
          </li>
        ))}
      </ul>

      <h2>Write your own</h2>
      <p>
        A tour is a small JSON file listing ordered <em>stops</em>, each pairing
        markdown prose with a range of lines in a source file. See the{" "}
        <a href={`${REPO}/blob/main/AUTHORING.md`}>authoring guide</a> for the
        full format and advice on putting together a good tour — it’s also the
        file to hand an agent when you want it to generate one.
      </p>
    </div>
  );
}
