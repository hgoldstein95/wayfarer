import { useEffect, useRef, useState } from "react";
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

type CodeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; lines: CodeLine[] };

export function Stop({ stop, index, loc }: Props) {
  const [code, setCode] = useState<CodeState | null>(
    stop.file ? { status: "loading" } : null,
  );

  useEffect(() => {
    if (!stop.file) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(stopRawUrl(loc, stop.file!), {
          cache: "no-cache",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching ${stop.file}`);
        }
        const text = await res.text();
        const lines = await highlightLines(text, stop.file!);
        if (!cancelled) setCode({ status: "ready", lines });
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
  }, [stop.file, loc]);

  return (
    <li className="stop">
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
          {code?.status === "loading" && (
            <div className="notice notice--inset">Loading code…</div>
          )}
          {code?.status === "error" && (
            <div className="notice notice--inset notice--error">
              {code.message}
            </div>
          )}
          {code?.status === "ready" && (
            <CodeView
              lines={code.lines}
              startLine={stop.line}
              endLine={stop.endLine}
            />
          )}
        </div>
      )}
    </li>
  );
}

interface CodeViewProps {
  lines: CodeLine[];
  startLine?: number;
  endLine?: number;
}

/**
 * Renders a file's lines. When the stop names a line range we collapse to just
 * that snippet (sized to fit), with buttons to reveal the rest of the file;
 * once expanded the view caps its height and scrolls.
 */
function CodeView({ lines, startLine, endLine }: CodeViewProps) {
  const total = lines.length;
  const hasRange = startLine != null;
  const from = startLine ?? 1;
  const to = endLine ?? startLine ?? total;
  const [expanded, setExpanded] = useState(false);

  const collapsed = hasRange && !expanded;
  const visibleFrom = collapsed ? from : 1;
  const visibleTo = collapsed ? to : total;
  const snippetRef = useRef<HTMLDivElement>(null);

  // When expanding, keep the snippet in view instead of jumping to the top.
  useEffect(() => {
    if (expanded && snippetRef.current) {
      snippetRef.current.scrollIntoView({ block: "center" });
    }
  }, [expanded]);

  const hiddenAbove = from - 1;
  const hiddenBelow = total - to;

  return (
    <div className="code">
      {collapsed && hiddenAbove > 0 && (
        <button
          className="code__reveal code__reveal--up"
          onClick={() => setExpanded(true)}
        >
          ▲ Show {hiddenAbove} line{hiddenAbove === 1 ? "" : "s"} above
        </button>
      )}

      <div className={"code__scroll" + (collapsed ? "" : " code__scroll--capped")}>
        <div className="code__lines">
          {lines.slice(visibleFrom - 1, visibleTo).map((line, i) => {
            const lineNo = visibleFrom + i;
            const inRange = lineNo >= from && lineNo <= to;
            const isFirstInRange = lineNo === from;
            return (
              <div
                key={lineNo}
                ref={isFirstInRange ? snippetRef : undefined}
                className={"codeline" + (inRange ? " codeline--hl" : "")}
              >
                {line.tokens.map((t, j) => (
                  <span key={j} style={{ color: t.color }}>
                    {t.content}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {collapsed && hiddenBelow > 0 && (
        <button
          className="code__reveal code__reveal--down"
          onClick={() => setExpanded(true)}
        >
          ▼ Show {hiddenBelow} line{hiddenBelow === 1 ? "" : "s"} below
        </button>
      )}

      {hasRange && expanded && (
        <button
          className="code__reveal code__reveal--collapse"
          onClick={() => setExpanded(false)}
        >
          ▲▼ Collapse to snippet
        </button>
      )}
    </div>
  );
}
