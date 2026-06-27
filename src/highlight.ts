import {
  codeToTokens,
  type BundledLanguage,
  type SpecialLanguage,
} from "shiki";

/** A single highlighted token: its text and resolved color. */
export interface Token {
  content: string;
  color: string;
}

/** One line of code as a list of colored tokens (empty for a blank line). */
export interface CodeLine {
  tokens: Token[];
}

/** Map a file extension to a Shiki language id. Unknown -> "text". */
function languageForFile(file: string): BundledLanguage | SpecialLanguage {
  const lang = pickLanguage(file);
  return lang as BundledLanguage | SpecialLanguage;
}

function pickLanguage(file: string): string {
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
 * Tokenize `code` into lines of colored tokens. Returning structured lines
 * (rather than an HTML blob) lets the UI render a snippet, reveal the rest of
 * the file, and control per-line layout.
 */
export async function highlightLines(
  code: string,
  file: string,
): Promise<CodeLine[]> {
  const lang = languageForFile(file);
  const { tokens } = await codeToTokens(code, { lang, theme: "github-dark" });
  return tokens.map((line) => ({
    tokens: line.map((t) => ({ content: t.content, color: t.color ?? "inherit" })),
  }));
}
