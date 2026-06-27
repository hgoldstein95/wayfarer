export interface TourStop {
  /** Stop heading shown above the content. */
  title: string;
  /** Markdown body for the stop (required). */
  content: string;
  /** Optional file to display, relative to the tour file's directory in the repo. */
  file?: string;
  /** Optional 1-based start line to emphasize. */
  line?: number;
  /** Optional 1-based end line to emphasize (defaults to `line`). */
  endLine?: number;
}

export interface Tour {
  title: string;
  /** Optional markdown intro shown before the stops. */
  description?: string;
  /**
   * Optional GitHub repository URL (e.g. https://github.com/owner/repo). When
   * set, every stop `file` is resolved relative to the root of this repo
   * instead of the tour file's own repo — letting a tour explore some other,
   * unrelated repository.
   */
  externalRepository?: string;
  stops: TourStop[];
}

/** Validate an unknown parsed JSON value as a Tour, throwing on problems. */
export function parseTour(data: unknown): Tour {
  if (typeof data !== "object" || data === null) {
    throw new Error("Tour file must be a JSON object.");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.title !== "string") {
    throw new Error('Tour is missing a string "title".');
  }
  if (!Array.isArray(obj.stops)) {
    throw new Error('Tour is missing a "stops" array.');
  }
  const stops: TourStop[] = obj.stops.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`Stop ${i + 1} must be an object.`);
    }
    const s = raw as Record<string, unknown>;
    if (typeof s.title !== "string") {
      throw new Error(`Stop ${i + 1} is missing a string "title".`);
    }
    if (typeof s.content !== "string") {
      throw new Error(`Stop ${i + 1} is missing a string "content".`);
    }
    if (s.file !== undefined && typeof s.file !== "string") {
      throw new Error(`Stop ${i + 1} has a non-string "file".`);
    }
    return {
      title: s.title,
      content: s.content,
      file: s.file as string | undefined,
      line: typeof s.line === "number" ? s.line : undefined,
      endLine: typeof s.endLine === "number" ? s.endLine : undefined,
    };
  });
  if (
    obj.externalRepository !== undefined &&
    typeof obj.externalRepository !== "string"
  ) {
    throw new Error('Tour has a non-string "externalRepository".');
  }
  return {
    title: obj.title,
    description: typeof obj.description === "string" ? obj.description : undefined,
    externalRepository:
      typeof obj.externalRepository === "string"
        ? obj.externalRepository
        : undefined,
    stops,
  };
}
