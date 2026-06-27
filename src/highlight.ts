import { codeToHtml } from "shiki";

/** Map a file extension to a Shiki language id. Unknown -> "text". */
function languageForFile(file: string): string {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    md: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    sql: "sql",
    xml: "xml",
    dockerfile: "docker",
    hs: "haskell",
    ml: "ocaml",
    ex: "elixir",
    exs: "elixir",
    clj: "clojure",
    lua: "lua",
    r: "r",
    dart: "dart",
    vue: "vue",
  };
  return map[ext] ?? "text";
}

/**
 * Highlight `code` to an HTML string. Lines in [startLine, endLine] (1-based)
 * get a `highlighted` class so the UI can emphasize them.
 */
export async function highlight(
  code: string,
  file: string,
  startLine?: number,
  endLine?: number,
): Promise<string> {
  const lang = languageForFile(file);
  const from = startLine ?? -1;
  const to = endLine ?? startLine ?? -1;
  return codeToHtml(code, {
    lang,
    theme: "github-dark",
    transformers: [
      {
        line(node, lineNumber) {
          if (from !== -1 && lineNumber >= from && lineNumber <= to) {
            this.addClassToHast(node, "line--highlighted");
          }
        },
      },
    ],
  });
}
