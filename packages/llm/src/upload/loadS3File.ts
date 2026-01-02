import { getS3FileBuffer } from "@jaypie/aws";

/**
 * Load a file from S3
 * @param bucket - S3 bucket name
 * @param key - S3 object key
 * @returns Buffer containing the file contents
 */
export async function loadS3File(bucket: string, key: string): Promise<Buffer> {
  return getS3FileBuffer({ bucket, key });
}
