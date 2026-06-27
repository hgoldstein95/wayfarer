import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseBlobUrl, tourRawUrl, type RepoLocation } from "./github";
import { parseTour, type Tour } from "./types";
import { Stop } from "./Stop";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tour: Tour; loc: RepoLocation };

export function App() {
  const [state, setState] = useState<LoadState>({ status: "idle" });

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
        const loc = parseBlobUrl(tourUrl);
        const res = await fetch(tourRawUrl(loc));
        if (!res.ok) {
          throw new Error(
            `Could not fetch tour file (HTTP ${res.status}). Check the URL and that the repo is public.`,
          );
        }
        const json = JSON.parse(await res.text());
        const tour = parseTour(json);
        if (!cancelled) setState({ status: "ready", tour, loc });
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
                <Stop key={i} stop={stop} index={i} loc={state.loc} />
              ))}
            </ol>
          </article>
        )}
      </main>
    </div>
  );
}

function Landing() {
  const example =
    "?tour=https://github.com/owner/repo/blob/main/path/to/tour.json";
  return (
    <div className="landing">
      <h1>Wayfarer</h1>
      <p>Render a code tour straight from a GitHub repository.</p>
      <p>
        Append a <code>?tour=</code> parameter pointing at a tour JSON file on
        GitHub:
      </p>
      <pre className="landing__example">
        <code>{example}</code>
      </pre>
      <p>
        File paths inside the tour are resolved relative to the tour file’s
        directory in that repo.
      </p>
    </div>
  );
}
