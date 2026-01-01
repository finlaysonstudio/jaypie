/**
 * Image extensions that are auto-detected from file paths
 */
const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tiff",
  "webp",
]);

/**
 * Mapping of file extensions to MIME types
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  // Images
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  webp: "image/webp",

  // Documents
  pdf: "application/pdf",

  // Text
  json: "application/json",
  txt: "text/plain",
};

/**
 * Extract file extension from a path or filename
 */
export function getFileExtension(filePath: string): string | undefined {
  const match = filePath.match(/\.(\w+)$/);
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Determine MIME type from file extension
 */
export function getMimeType(filePath: string): string | undefined {
  const ext = getFileExtension(filePath);
  return ext ? EXTENSION_TO_MIME[ext] : undefined;
}

/**
 * Check if a file path has an image extension
 */
export function isImageExtension(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

/**
 * Check if a file path has a PDF extension
 */
export function isPdfExtension(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === "pdf";
}
