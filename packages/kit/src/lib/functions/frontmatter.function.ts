import { dump, load } from "js-yaml";

//
//
// Constants
//

const DELIMITER = "---";
const CLOSE = "\n---";

//
//
// Types
//

export interface FrontmatterResult<T = Record<string, unknown>> {
  content: string;
  data: T;
}

//
//
// Main
//

/**
 * Parse YAML frontmatter from a markdown string. Mirrors the slice of
 * `gray-matter` Jaypie relied on (default `---` delimiters, YAML engine)
 * without its abandoned, js-yaml@3-pinned dependency.
 *
 * Returns the parsed frontmatter `data` and the remaining `content` body. When
 * no frontmatter block is present, `data` is an empty object and `content` is
 * the input unchanged (sans any byte-order mark).
 */
export function parseFrontmatter<T = Record<string, unknown>>(
  content: string,
): FrontmatterResult<T> {
  let str = content;
  // Strip a leading byte-order mark, if present.
  if (str.charCodeAt(0) === 0xfeff) {
    str = str.slice(1);
  }
  // Frontmatter must open with the delimiter on the first line; a fourth dash
  // (`----`) is not a delimiter.
  if (str.slice(0, 3) !== DELIMITER || str.charAt(3) === "-") {
    return { content: str, data: {} as T };
  }
  const afterOpen = str.slice(3);
  let closeIndex = afterOpen.indexOf(CLOSE);
  if (closeIndex === -1) {
    closeIndex = afterOpen.length;
  }
  const block = afterOpen.slice(0, closeIndex);
  const data = (load(block) ?? {}) as T;
  let body = afterOpen.slice(closeIndex + CLOSE.length);
  // gray-matter strips the single newline that follows the closing delimiter.
  if (body.charAt(0) === "\r") {
    body = body.slice(1);
  }
  if (body.charAt(0) === "\n") {
    body = body.slice(1);
  }
  return { content: body, data };
}

/**
 * Serialize a markdown body and frontmatter object back into a string with a
 * leading YAML frontmatter block. Mirrors gray-matter's `stringify`: an empty
 * `data` object yields the body alone (with a trailing newline).
 */
export function stringifyFrontmatter(
  content: string,
  data: Record<string, unknown> = {},
): string {
  const matter = dump(data).trim();
  const body = content.slice(-1) === "\n" ? content : `${content}\n`;
  if (matter === "" || matter === "{}") {
    return body;
  }
  return `${DELIMITER}\n${matter}\n${DELIMITER}\n${body}`;
}
