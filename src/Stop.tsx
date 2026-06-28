import { useEffect, useRef, useState, type CSSProperties } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { blobLink, stopRawUrl, type RepoLocation } from "./github";
import { highlightLines, type CodeLine } from "./highlight";
import type { TourStop } from "./types";

interface Props {
  stop: TourStop;
  index: number;
  loc: RepoLocation;
}

/** Lines of lead-in tokenized before a stop's `line` to warm up the
 *  highlighter — Shiki sees a few preceding lines so multi-line constructs that
 *  open just above the snippet still color correctly. Not displayed. */
const CONTEXT_LINES = 10;

/** How many lines on each side of the snippet "expand" reveals. Beyond this the
 *  view stops growing and links out to GitHub, so a stop over a huge file can't
 *  blow up into a thousand-line wall of code. */
const EXPAND_MARGIN = 50;

type CodeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      /** Raw file text, kept so we can highlight the full file on expand. */
      text: string;
      /** Total line count of the file. */
      total: number;
      /** Highlighted snippet window. */
      snippet: CodeLine[];
      /** File line number of `snippet[0]`. */
      snippetOffset: number;
    };

export function Stop({ stop, index, loc }: Props) {
  const itemRef = useRef<HTMLLIElement>(null);
  // Defer fetching/highlighting until the stop scrolls near the viewport, so a
  // tour over many large files doesn't fetch and tokenize everything up front.
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState<CodeState | null>(null);

  // The expanded ±EXPAND_MARGIN window, highlighted lazily the first time the
  // user expands. `offset` is the file line number of `lines[0]`.
  const [expanded, setExpanded] = useState(false);
  const [expandedWindow, setExpandedWindow] = useState<{
    lines: CodeLine[];
    offset: number;
  } | null>(null);

  useEffect(() => {
    if (!stop.file || visible) return;
    const el = itemRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [stop.file, visible]);

  useEffect(() => {
    if (!stop.file || !visible) return;
    let cancelled = false;
    setCode({ status: "loading" });

    (async () => {
      try {
        const res = await fetch(stopRawUrl(loc, stop.file!), {
          cache: "no-cache",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching ${stop.file}`);
        }
        const text = await res.text();
        const allLines = text.split("\n");
        const total = allLines.length;

        // Tokenize a window that starts a few lines before `line` so Shiki has
        // preceding context (multi-line constructs opening just above the
        // snippet still color correctly). The lead-in only warms the
        // highlighter — we slice it back off before displaying. With no `line`
        // named there's nothing to window, so tokenize the whole file.
        const from = stop.line ? Math.max(1, stop.line - CONTEXT_LINES) : 1;
        const to = stop.endLine ?? stop.line ?? total;
        const windowText = stop.line
          ? allLines.slice(from - 1, to).join("\n")
          : text;
        const windowLines = await highlightLines(windowText, stop.file!);
        const leadIn = stop.line ? stop.line - from : 0;
        const snippet = windowLines.slice(leadIn);
        const snippetOffset = stop.line ?? 1;

        if (!cancelled) {
          setCode({ status: "ready", text, total, snippet, snippetOffset });
        }
      } catch (err) {
        if (!cancelled) {
          setCode({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stop.file, stop.line, stop.endLine, loc, visible]);

  // Highlight the ±EXPAND_MARGIN window the first time it's expanded (kept off
  // the initial render so we don't pay for it until asked). We never highlight
  // the whole file — past the margin the view links out to GitHub instead.
  useEffect(() => {
    if (!expanded || expandedWindow || code?.status !== "ready") return;
    let cancelled = false;
    (async () => {
      const allLines = code.text.split("\n");
      const from = Math.max(1, (stop.line ?? 1) - EXPAND_MARGIN);
      const to = Math.min(
        code.total,
        (stop.endLine ?? stop.line ?? code.total) + EXPAND_MARGIN,
      );
      // A few extra lines of lead-in so Shiki colors the top of the window
      // correctly; sliced back off before we store it (same trick as snippet).
      const ctxFrom = Math.max(1, from - CONTEXT_LINES);
      const windowText = allLines.slice(ctxFrom - 1, to).join("\n");
      const windowLines = await highlightLines(windowText, stop.file!);
      const lines = windowLines.slice(from - ctxFrom);
      if (!cancelled) setExpandedWindow({ lines, offset: from });
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, expandedWindow, code, stop.file, stop.line, stop.endLine]);

  return (
    <li className="stop" ref={itemRef}>
      <div className="stop__content">
        <h2 className="stop__title">
          <span className="stop__num">{index + 1}</span>
          {stop.title}
        </h2>
        <div className="markdown">
          <Markdown remarkPlugins={[remarkGfm]}>{stop.content}</Markdown>
        </div>
      </div>

      {stop.file && (
        <div className="stop__code">
          <div className="stop__filebar">
            <a
              href={blobLink(loc, stop.file, stop.line)}
              target="_blank"
              rel="noreferrer"
            >
              {stop.file}
              {stop.line
                ? `:${stop.line}${stop.endLine ? `-${stop.endLine}` : ""}`
                : ""}
            </a>
          </div>
          {(!code || code.status === "loading") && (
            <div className="notice notice--inset">Loading code…</div>
          )}
          {code?.status === "error" && (
            <div className="notice notice--inset notice--error">
              {code.message}
            </div>
          )}
          {code?.status === "ready" && (
            <CodeView
              snippet={code.snippet}
              snippetOffset={code.snippetOffset}
              total={code.total}
              expandedLines={expandedWindow?.lines ?? null}
              expandedOffset={expandedWindow?.offset ?? 1}
              startLine={stop.line}
              endLine={stop.endLine}
              expanded={expanded}
              githubHref={blobLink(loc, stop.file, stop.line)}
              onExpand={() => setExpanded(true)}
              onCollapse={() => setExpanded(false)}
            />
          )}
        </div>
      )}
    </li>
  );
}

interface CodeViewProps {
  /** Highlighted snippet window (a slice of the file). */
  snippet: CodeLine[];
  /** File line number of `snippet[0]`. */
  snippetOffset: number;
  /** Total line count of the file. */
  total: number;
  /** Highlighted ±EXPAND_MARGIN window, once expanded (null until ready). */
  expandedLines: CodeLine[] | null;
  /** File line number of `expandedLines[0]`. */
  expandedOffset: number;
  startLine?: number;
  endLine?: number;
  expanded: boolean;
  /** github.com link to the file, for "view the rest on GitHub". */
  githubHref: string;
  onExpand: () => void;
  onCollapse: () => void;
}

/**
 * Renders a stop's code. Collapsed, it shows just the focus range, with buttons
 * to reveal the rest of the file; expanded, it shows the whole file in a capped,
 * scrolling view.
 */
function CodeView({
  snippet,
  snippetOffset,
  total,
  expandedLines,
  expandedOffset,
  startLine,
  endLine,
  expanded,
  githubHref,
  onExpand,
  onCollapse,
}: CodeViewProps) {
  const hasRange = startLine != null;
  const from = startLine ?? 1;
  const to = endLine ?? startLine ?? total;

  // Expanded once the window has been highlighted; until then keep showing the
  // snippet so the view doesn't blank out mid-expand.
  const showingFull = expanded && expandedLines != null;
  const lines = showingFull ? expandedLines : snippet;
  const offset = showingFull ? expandedOffset : snippetOffset;

  const snippetRef = useRef<HTMLDivElement>(null);

  // When expanding, keep the snippet in view instead of jumping to the top.
  useEffect(() => {
    if (showingFull && snippetRef.current) {
      snippetRef.current.scrollIntoView({ block: "center" });
    }
  }, [showingFull]);

  const hiddenAbove = snippetOffset - 1;
  const hiddenBelow = total - (snippetOffset + snippet.length - 1);
  // Lines still hidden past the expanded window — these link out to GitHub
  // rather than growing the view further.
  const moreAbove = showingFull ? offset - 1 : 0;
  const moreBelow = showingFull ? total - (offset + lines.length - 1) : 0;

  return (
    <div className="code">
      {!showingFull && hiddenAbove > 0 && (
        <button className="code__reveal code__reveal--up" onClick={onExpand}>
          ▲ {hiddenAbove} line{hiddenAbove === 1 ? "" : "s"} above
        </button>
      )}
      {showingFull && moreAbove > 0 && (
        <a
          className="code__reveal code__reveal--up"
          href={githubHref}
          target="_blank"
          rel="noreferrer"
        >
          ▲ {moreAbove} more line{moreAbove === 1 ? "" : "s"} above — open on
          GitHub →
        </a>
      )}

      <div className="code__scroll">
        <div className="code__lines">
          {lines.map((line, i) => {
            const lineNo = offset + i;
            // Only emphasize the range when expanded; collapsed, every visible
            // line is the snippet so the highlight adds nothing.
            const inRange = showingFull && hasRange && lineNo >= from && lineNo <= to;
            const isFirstInRange = lineNo === from;
            return (
              <div
                key={lineNo}
                ref={isFirstInRange ? snippetRef : undefined}
                className={"codeline" + (inRange ? " codeline--hl" : "")}
              >
                {line.tokens.map((t, j) => (
                  <span
                    key={j}
                    style={{ "--cl": t.light, "--cd": t.dark } as CSSProperties}
                  >
                    {t.content}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {!showingFull && hiddenBelow > 0 && (
        <button className="code__reveal code__reveal--down" onClick={onExpand}>
          ▼ {hiddenBelow} line{hiddenBelow === 1 ? "" : "s"} below
        </button>
      )}
      {showingFull && moreBelow > 0 && (
        <a
          className="code__reveal code__reveal--down"
          href={githubHref}
          target="_blank"
          rel="noreferrer"
        >
          ▼ {moreBelow} more line{moreBelow === 1 ? "" : "s"} below — open on
          GitHub →
        </a>
      )}

      {expanded && !expandedLines && (
        <div className="notice notice--inset">Loading…</div>
      )}

      {hasRange && showingFull && (
        <button
          className="code__reveal code__reveal--collapse"
          onClick={onCollapse}
        >
          ▲▼ Collapse to snippet
        </button>
      )}
    </div>
  );
}
