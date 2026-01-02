import { readFile } from "fs/promises";
import { resolve } from "path";

/**
 * Load a file from the local filesystem
 * @param filePath - Path to the file (relative paths resolve from process.cwd())
 * @returns Buffer containing the file contents
 */
export async function loadLocalFile(filePath: string): Promise<Buffer> {
  const absolutePath = resolve(process.cwd(), filePath);
  return readFile(absolutePath);
}
