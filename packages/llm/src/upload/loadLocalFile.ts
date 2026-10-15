import { BadRequestError } from "@jaypie/errors";
import { readFile } from "fs/promises";
import { resolve } from "path";

/**
 * Load a file from the local filesystem
 * @param filePath - Path to the file (relative paths resolve from process.cwd())
 * @returns Buffer containing the file contents
 * @throws BadRequestError when the file does not exist
 */
export async function loadLocalFile(filePath: string): Promise<Buffer> {
  const absolutePath = resolve(process.cwd(), filePath);
  try {
    return await readFile(absolutePath);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new BadRequestError(`File not found: ${filePath}`);
    }
    throw error;
  }
}
