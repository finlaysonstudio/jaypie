import {
  LlmInputContent,
  LlmInputContentFile,
  LlmInputContentImage,
  LlmInputContentText,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
  LlmOperateInput,
  LlmOperateInputContent,
  LlmOperateInputFile,
  LlmOperateInputImage,
} from "../types/LlmProvider.interface.js";
import {
  isLlmOperateInputFile,
  isLlmOperateInputImage,
} from "../types/LlmOperateInput.guards.js";
import {
  getMimeType,
  isImageExtension,
  isPdfExtension,
} from "./detectMimeType.js";
import { extractPdfPages } from "./extractPdfPages.js";
import { loadLocalFile } from "./loadLocalFile.js";
import { loadS3File } from "./loadS3File.js";

/**
 * Resolved content ready for LLM providers
 */
interface ResolvedContent {
  data: string; // base64 data
  mimeType: string;
  filename: string;
}

/**
 * Load file data from source (provided data, S3, or local filesystem)
 */
async function loadFileData(
  item: LlmOperateInputFile | LlmOperateInputImage,
): Promise<Buffer> {
  // Get the path from either file or image property
  const path = "file" in item ? item.file : item.image;

  // Priority 1: Use provided data directly
  if (item.data) {
    return Buffer.from(item.data, "base64");
  }

  // Priority 2: Load from S3 (explicit bucket or CDK_ENV_BUCKET fallback)
  const bucket = item.bucket ?? process.env.CDK_ENV_BUCKET;
  if (bucket) {
    return loadS3File(bucket, path);
  }

  // Priority 3: Load from local filesystem
  return loadLocalFile(path);
}

/**
 * Resolve a file input to content ready for LLM
 */
async function resolveFileInput(
  item: LlmOperateInputFile,
): Promise<ResolvedContent> {
  let buffer = await loadFileData(item);
  const mimeType = getMimeType(item.file) || "application/octet-stream";
  const filename = item.file.split("/").pop() || item.file;

  // Handle PDF page extraction
  if (isPdfExtension(item.file) && item.pages && item.pages.length > 0) {
    buffer = await extractPdfPages(buffer, item.pages);
  }

  return {
    data: buffer.toString("base64"),
    filename,
    mimeType,
  };
}

/**
 * Resolve an image input to content ready for LLM
 */
async function resolveImageInput(
  item: LlmOperateInputImage,
): Promise<ResolvedContent> {
  const buffer = await loadFileData(item);
  const mimeType = getMimeType(item.image) || "image/png";
  const filename = item.image.split("/").pop() || item.image;

  return {
    data: buffer.toString("base64"),
    filename,
    mimeType,
  };
}

/**
 * Convert resolved content to LlmInputContent
 */
function toInputContent(
  resolved: ResolvedContent,
  isImage: boolean,
): LlmInputContent {
  if (isImage) {
    const imageContent: LlmInputContentImage = {
      image_url: `data:${resolved.mimeType};base64,${resolved.data}`,
      type: LlmMessageType.InputImage,
    };
    return imageContent;
  }

  const fileContent: LlmInputContentFile = {
    file_data: `data:${resolved.mimeType};base64,${resolved.data}`,
    filename: resolved.filename,
    type: LlmMessageType.InputFile,
  };
  return fileContent;
}

/**
 * Resolve a single content item
 */
async function resolveContentItem(
  item: LlmOperateInputContent,
): Promise<LlmInputContent> {
  // String becomes text content
  if (typeof item === "string") {
    const textContent: LlmInputContentText = {
      text: item,
      type: LlmMessageType.InputText,
    };
    return textContent;
  }

  // Image input
  if (isLlmOperateInputImage(item)) {
    const resolved = await resolveImageInput(item);
    return toInputContent(resolved, true);
  }

  // File input
  if (isLlmOperateInputFile(item)) {
    const resolved = await resolveFileInput(item);
    // Check if the file is actually an image based on extension
    const isImage = isImageExtension(item.file);
    return toInputContent(resolved, isImage);
  }

  // Fallback - shouldn't reach here if types are correct
  throw new Error(`Unknown content item type: ${JSON.stringify(item)}`);
}

/**
 * Resolve LlmOperateInput to LlmInputMessage
 *
 * This function takes the simplified LlmOperateInput format and resolves
 * all files/images from their sources (provided data, S3, or local filesystem),
 * converting them to the standard LlmInputMessage format.
 *
 * @param input - LlmOperateInput array
 * @returns LlmInputMessage ready for LLM providers
 */
export async function resolveOperateInput(
  input: LlmOperateInput,
): Promise<LlmInputMessage> {
  const content: LlmInputContent[] = await Promise.all(
    input.map(resolveContentItem),
  );

  return {
    content,
    role: LlmMessageRole.User,
    type: LlmMessageType.Message,
  };
}
