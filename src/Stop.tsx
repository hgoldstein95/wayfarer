import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { blobLink, stopRawUrl, type RepoLocation } from "./github";
import { highlight } from "./highlight";
import type { TourStop } from "./types";

interface Props {
  stop: TourStop;
  index: number;
  loc: RepoLocation;
}

type CodeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; html: string };

export function Stop({ stop, index, loc }: Props) {
  const [code, setCode] = useState<CodeState | null>(
    stop.file ? { status: "loading" } : null,
  );

  useEffect(() => {
    if (!stop.file) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(stopRawUrl(loc, stop.file!));
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching ${stop.file}`);
        }
        const text = await res.text();
        const html = await highlight(text, stop.file!, stop.line, stop.endLine);
        if (!cancelled) setCode({ status: "ready", html });
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
  }, [stop.file, stop.line, stop.endLine, loc]);

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
            <a href={blobLink(loc, stop.file, stop.line)} target="_blank" rel="noreferrer">
              {stop.file}
              {stop.line ? `:${stop.line}${stop.endLine ? `-${stop.endLine}` : ""}` : ""}
            </a>
          </div>
          {code?.status === "loading" && (
            <div className="stop__codebody notice">Loading code…</div>
          )}
          {code?.status === "error" && (
            <div className="stop__codebody notice notice--error">
              {code.message}
            </div>
          )}
          {code?.status === "ready" && (
            <div
              className="stop__codebody"
              dangerouslySetInnerHTML={{ __html: code.html }}
            />
          )}
        </div>
      )}
    </li>
  );
}
