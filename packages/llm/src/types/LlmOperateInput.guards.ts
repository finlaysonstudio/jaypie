import type {
  LlmOperateInput,
  LlmOperateInputContent,
  LlmOperateInputFile,
  LlmOperateInputImage,
} from "./LlmProvider.interface.js";

/**
 * Type guard to check if an item is an LlmOperateInputFile
 */
export function isLlmOperateInputFile(
  item: unknown,
): item is LlmOperateInputFile {
  return (
    typeof item === "object" &&
    item !== null &&
    "file" in item &&
    typeof (item as LlmOperateInputFile).file === "string"
  );
}

/**
 * Type guard to check if an item is an LlmOperateInputImage
 */
export function isLlmOperateInputImage(
  item: unknown,
): item is LlmOperateInputImage {
  return (
    typeof item === "object" &&
    item !== null &&
    "image" in item &&
    typeof (item as LlmOperateInputImage).image === "string"
  );
}

/**
 * Type guard to check if an item is an LlmOperateInputContent
 */
export function isLlmOperateInputContent(
  item: unknown,
): item is LlmOperateInputContent {
  return (
    typeof item === "string" ||
    isLlmOperateInputFile(item) ||
    isLlmOperateInputImage(item)
  );
}

/**
 * Type guard to check if input is an LlmOperateInput array
 */
export function isLlmOperateInput(input: unknown): input is LlmOperateInput {
  return (
    Array.isArray(input) &&
    input.length > 0 &&
    input.every(isLlmOperateInputContent)
  );
}
