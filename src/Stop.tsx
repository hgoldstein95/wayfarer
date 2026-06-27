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

  // Full-file highlight, computed lazily the first time the user expands.
  const [expanded, setExpanded] = useState(false);
  const [full, setFull] = useState<CodeLine[] | null>(null);

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

  // Highlight the whole file the first time it's expanded (kept off the
  // initial render so large files don't pay for it until asked).
  useEffect(() => {
    if (!expanded || full || code?.status !== "ready") return;
    let cancelled = false;
    (async () => {
      const lines = await highlightLines(code.text, stop.file!);
      if (!cancelled) setFull(lines);
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, full, code, stop.file]);

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
              full={full}
              startLine={stop.line}
              endLine={stop.endLine}
              expanded={expanded}
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
  /** Highlighted full file, once expanded (null until ready). */
  full: CodeLine[] | null;
  startLine?: number;
  endLine?: number;
  expanded: boolean;
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
  full,
  startLine,
  endLine,
  expanded,
  onExpand,
  onCollapse,
}: CodeViewProps) {
  const hasRange = startLine != null;
  const from = startLine ?? 1;
  const to = endLine ?? startLine ?? total;

  // Expanded once the full file has been highlighted; until then keep showing
  // the snippet so the view doesn't blank out mid-expand.
  const showingFull = expanded && full != null;
  const lines = showingFull ? full : snippet;
  const offset = showingFull ? 1 : snippetOffset;

  const snippetRef = useRef<HTMLDivElement>(null);

  // When expanding, keep the snippet in view instead of jumping to the top.
  useEffect(() => {
    if (showingFull && snippetRef.current) {
      snippetRef.current.scrollIntoView({ block: "center" });
    }
  }, [showingFull]);

  const hiddenAbove = snippetOffset - 1;
  const hiddenBelow = total - (snippetOffset + snippet.length - 1);

  return (
    <div className="code">
      {!showingFull && hiddenAbove > 0 && (
        <button className="code__reveal code__reveal--up" onClick={onExpand}>
          ▲ {hiddenAbove} line{hiddenAbove === 1 ? "" : "s"} above
        </button>
      )}

      <div className={"code__scroll" + (showingFull ? " code__scroll--capped" : "")}>
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

      {expanded && !full && (
        <div className="notice notice--inset">Loading full file…</div>
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
