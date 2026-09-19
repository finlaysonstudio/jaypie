import { BadRequestError } from "@jaypie/errors";

import {
  LlmOcrDocument,
  LlmOcrResolvedDocument,
} from "../types/LlmOcr.interface.js";
import {
  LlmOperateInputFile,
  LlmOperateInputImage,
} from "../types/LlmProvider.interface.js";
import {
  extractPdfPages,
  getExtensionForMimeType,
  getMimeType,
  isPdfExtension,
  loadFileData,
} from "../upload/index.js";

//
//
// Constants
//

const DATA_URI_PATTERN = /^data:([^;,]+)?(;base64)?,(.*)$/s;
const DEFAULT_DOCUMENT_NAME = "document";
const DEFAULT_MIME_TYPE = "application/octet-stream";
const URL_PATTERN = /^https?:\/\//i;

//
//
// Helpers
//

/** A document that already went through resolution */
export function isLlmOcrResolvedDocument(
  document: unknown,
): document is LlmOcrResolvedDocument {
  if (!document || typeof document !== "object") {
    return false;
  }
  const candidate = document as Partial<LlmOcrResolvedDocument>;
  return (
    typeof candidate.filename === "string" &&
    typeof candidate.mimeType === "string" &&
    !!candidate.source &&
    (candidate.source.kind === "url" || candidate.source.kind === "data")
  );
}

function basename(path: string): string {
  const stripped = path.split(/[?#]/)[0];
  return stripped.split("/").pop() || stripped;
}

function fromUrl(url: string): LlmOcrResolvedDocument {
  const filename = basename(url) || DEFAULT_DOCUMENT_NAME;
  return {
    filename,
    mimeType: getMimeType(filename) || DEFAULT_MIME_TYPE,
    source: { kind: "url", url },
  };
}

function fromDataUri(uri: string): LlmOcrResolvedDocument {
  const match = DATA_URI_PATTERN.exec(uri);
  if (!match) {
    throw new BadRequestError("Document data URI is malformed");
  }
  const [, mime, base64Flag, payload] = match;
  const mimeType = (mime || DEFAULT_MIME_TYPE).toLowerCase();
  const buffer = base64Flag
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  const extension = getExtensionForMimeType(mimeType);
  return {
    filename: extension
      ? `${DEFAULT_DOCUMENT_NAME}.${extension}`
      : DEFAULT_DOCUMENT_NAME,
    mimeType,
    source: { kind: "data", buffer },
  };
}

async function fromInput(
  item: LlmOperateInputFile | LlmOperateInputImage,
): Promise<LlmOcrResolvedDocument> {
  const path = "file" in item ? item.file : item.image;
  let buffer = await loadFileData(item);
  const pages = "pages" in item ? item.pages : undefined;
  if (isPdfExtension(path) && pages && pages.length > 0) {
    buffer = await extractPdfPages(buffer, pages);
  }
  return {
    filename: basename(path) || DEFAULT_DOCUMENT_NAME,
    mimeType: getMimeType(path) || DEFAULT_MIME_TYPE,
    source: { kind: "data", buffer },
  };
}

//
//
// Main
//

/**
 * Resolve any accepted document form to a URL or a buffer.
 *
 * - `https://` strings pass through: both vendors fetch them server side.
 * - `data:` strings decode to a buffer so the two byte paths converge.
 * - Every other string is a local path or an S3 key (when `CDK_ENV_BUCKET`
 *   is set), loaded through the same priority `operate()` uses.
 * - `{ file, bucket?, data?, pages? }` and `{ image, ... }` load the same
 *   way; `pages` on a PDF trims the bytes locally before upload.
 *
 * An already-resolved document is returned as is, so the facade can resolve
 * once and hand the result to every attempt in a fallback chain.
 */
export async function resolveOcrDocument(
  document: LlmOcrDocument | LlmOcrResolvedDocument,
): Promise<LlmOcrResolvedDocument> {
  if (isLlmOcrResolvedDocument(document)) {
    return document;
  }
  if (typeof document === "string") {
    const trimmed = document.trim();
    if (!trimmed) {
      throw new BadRequestError("Document must not be empty");
    }
    if (URL_PATTERN.test(trimmed)) {
      return fromUrl(trimmed);
    }
    if (trimmed.startsWith("data:")) {
      return fromDataUri(trimmed);
    }
    return fromInput({ file: trimmed });
  }
  if (document && typeof document === "object") {
    if ("file" in document || "image" in document) {
      return fromInput(document);
    }
  }
  throw new BadRequestError("Document must be a string, file, or image input");
}

/** Render a resolved buffer as the `data:` URI vendors accept in place of a URL */
export function toDataUri(document: LlmOcrResolvedDocument): string {
  if (document.source.kind === "url") {
    return document.source.url;
  }
  return `data:${document.mimeType};base64,${document.source.buffer.toString("base64")}`;
}
