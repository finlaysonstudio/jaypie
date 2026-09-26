import { JsonObject } from "@jaypie/types";

import { LlmOcrImage, LlmOcrPage } from "../../types/LlmOcr.interface.js";
import { getMimeType } from "../../upload/index.js";

//
//
// Constants
//

/**
 * `bbox_annotation_format` sent on every Mistral OCR request so each extracted
 * image carries a label. The enum steers the vision pass toward document
 * artifacts (signatures, seals, stamps, identification) that a generic schema
 * misreads: a signature became a "line graph" and a driver's license a
 * "notary signature" when an example named one. A caller replaces it through `providerOptions.bbox_annotation_format`
 * or disables it with `null`.
 */
export const DEFAULT_BBOX_ANNOTATION_FORMAT: JsonObject = {
  json_schema: {
    name: "image",
    schema: {
      additionalProperties: false,
      description:
        "A visual element cropped from a scanned or digital document. Classify the whole element: a card or document that contains a signature is that card or document. Handwritten strokes near a signature line or printed name are signatures, not charts.",
      properties: {
        description: {
          description:
            'Concise label naming what the element is and, when legible, whose or which it is, e.g. "Florida driver\'s license of Jane Doe", "Signature of John Smith", "County recorder seal", "Bar chart of monthly revenue". One sentence.',
          type: "string",
        },
        image_type: {
          description: "Kind of visual element",
          enum: [
            "chart",
            "diagram",
            "handwriting",
            "identification",
            "logo",
            "other",
            "photo",
            "seal",
            "signature",
            "stamp",
            "table",
          ],
          type: "string",
        },
      },
      required: ["image_type", "description"],
      type: "object",
    },
    strict: true,
  },
  type: "json_schema",
};

const BLOCK_SEPARATOR = "\n\n";
const SIGNATURE_LABEL = "Signature";

//
//
// Types
//

/** One entry of `pages[].blocks`, in reading order (OCR 4 and later) */
interface MistralOcrBlock {
  content?: string | null;
  image_id?: string | null;
  table_id?: string | null;
  type: string;
  [key: string]: unknown;
}

interface MistralOcrImage {
  id: string;
  image_annotation?: string | null;
  image_base64?: string | null;
  [key: string]: unknown;
}

/** One page of Mistral's `OCRResponse`, 0-indexed on the wire */
export interface MistralOcrPage {
  blocks?: MistralOcrBlock[] | null;
  footer?: string | null;
  header?: string | null;
  images?: MistralOcrImage[];
  index: number;
  markdown?: string;
  tables?: MistralOcrTable[];
  [key: string]: unknown;
}

interface MistralOcrTable {
  content: string;
  id: string;
  [key: string]: unknown;
}

//
//
// Helpers
//

/** Keep alt text on one line and free of brackets that would end it early */
function toAltText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[[\]]/g, (bracket) => `\\${bracket}`)
    .trim();
}

/** Base64 arrives with or without a `data:` prefix depending on the route */
function toImageDataUri(
  image: MistralOcrImage,
  mimeType?: string,
): string | undefined {
  const base64 = image.image_base64;
  if (!base64) {
    return undefined;
  }
  if (base64.startsWith("data:")) {
    return base64;
  }
  return `data:${mimeType ?? "image/jpeg"};base64,${base64}`;
}

/**
 * `image_annotation` is a JSON string shaped by the annotation format. A
 * caller-supplied schema may not be JSON-shaped as ours is, so non-object
 * output survives as the description itself.
 */
function parseAnnotation(annotation?: string | null): {
  annotation?: JsonObject;
  description?: string;
  type?: string;
} {
  if (!annotation) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(annotation);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const object = parsed as JsonObject;
      const description =
        typeof object.description === "string" && object.description.trim()
          ? object.description.trim()
          : undefined;
      const type =
        typeof object.image_type === "string" ? object.image_type : undefined;
      return {
        annotation: object,
        ...(description ? { description } : {}),
        ...(type ? { type } : {}),
      };
    }
  } catch {
    // Not JSON; fall through to the raw string
  }
  return { description: annotation.trim() };
}

function toOcrImage(image: MistralOcrImage, page: number): LlmOcrImage {
  const mimeType = getMimeType(image.id);
  const { annotation, description, type } = parseAnnotation(
    image.image_annotation,
  );
  return {
    ...(annotation ? { annotation } : {}),
    data: toImageDataUri(image, mimeType),
    ...(description ? { description } : {}),
    id: image.id,
    mimeType,
    page,
    ...(type ? { type } : {}),
  };
}

/**
 * Swap vendor placeholders for content: `[tbl-0.md](tbl-0.md)` becomes the
 * table itself, and `![img-0.jpeg](img-0.jpeg)` keeps its link but carries the
 * image description as alt text.
 */
function inlinePlaceholders(
  text: string,
  { images, tables }: { images: LlmOcrImage[]; tables: MistralOcrTable[] },
): string {
  let result = text;
  for (const table of tables) {
    result = result.split(`[${table.id}](${table.id})`).join(table.content);
  }
  for (const image of images) {
    const alt = image.description ?? image.type;
    if (alt) {
      result = result
        .split(`![${image.id}](${image.id})`)
        .join(`![${toAltText(alt)}](${image.id})`);
    }
  }
  return result;
}

/**
 * Blocks carry types the markdown flattens away, so a signature renders as
 * `[Signature: Jane Doe]` rather than a bare name. Header and footer blocks
 * are skipped once extracted to their own fields, matching the markdown.
 */
function renderBlocks(
  page: MistralOcrPage,
  placeholders: { images: LlmOcrImage[]; tables: MistralOcrTable[] },
): string {
  const rendered: string[] = [];
  for (const block of page.blocks ?? []) {
    if (block.type === "header" && page.header) {
      continue;
    }
    if (block.type === "footer" && page.footer) {
      continue;
    }
    const content = inlinePlaceholders(
      (block.content ?? "").trim(),
      placeholders,
    );
    if (block.type === "signature") {
      const name = content.replace(/\s+/g, " ").trim();
      rendered.push(
        name ? `[${SIGNATURE_LABEL}: ${name}]` : `[${SIGNATURE_LABEL}]`,
      );
      continue;
    }
    if (content) {
      rendered.push(content);
    }
  }
  return rendered.join(BLOCK_SEPARATOR);
}

//
//
// Main
//

/**
 * One Mistral page in the common shape. Markdown is rebuilt from blocks when
 * the engine returns them (OCR 4 and later) and patched in place otherwise;
 * either way tables are inline and images are described.
 */
export function toOcrPage(page: MistralOcrPage): LlmOcrPage {
  const pageNumber = page.index + 1;
  const images = (page.images ?? []).map((image) =>
    toOcrImage(image, pageNumber),
  );
  const placeholders = { images, tables: page.tables ?? [] };
  const markdown = page.blocks?.length
    ? renderBlocks(page, placeholders)
    : inlinePlaceholders(page.markdown ?? "", placeholders);
  return {
    ...(page.footer ? { footer: page.footer } : {}),
    ...(page.header ? { header: page.header } : {}),
    images,
    markdown,
    page: pageNumber,
    raw: page as JsonObject,
    success: true,
  };
}
