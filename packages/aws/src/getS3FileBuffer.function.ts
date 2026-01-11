import { ConfigurationError } from "@jaypie/errors";
import { JAYPIE } from "@jaypie/kit";
import { log } from "@jaypie/logger";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

//
//
// Types
//

interface JaypieLogger {
  trace: {
    var: (data: Record<string, unknown>) => void;
  };
  var: (data: Record<string, unknown>) => void;
  debug: (data: unknown) => void;
  error: (message: string) => void;
}

interface GetS3FileBufferOptions {
  bucket: string;
  key: string;
}

//
//
// Main
//

/**
 * Fetch a file from S3 as a Buffer
 * @param bucket S3 bucket name
 * @param key S3 object key
 * @returns Buffer containing the file contents
 * @throws {ConfigurationError} if bucket or key is not provided
 */
async function getS3FileBuffer({
  bucket,
  key,
}: GetS3FileBufferOptions): Promise<Buffer> {
  const logger = log.lib({ lib: JAYPIE.LIB.AWS }) as unknown as JaypieLogger;
  logger.trace.var({ getS3FileBuffer: { bucket, key } });

  if (!bucket) {
    throw new ConfigurationError("No S3 bucket provided");
  }
  if (!key) {
    throw new ConfigurationError("No S3 key provided");
  }

  const client = new S3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  try {
    const response = await client.send(command);

    if (!response.Body) {
      throw new ConfigurationError(
        `Failed to retrieve file content from S3: ${bucket}/${key}`,
      );
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    logger.var({ getS3FileBuffer: { bucket, key, size: buffer.length } });

    return buffer;
  } catch (error) {
    logger.error("[@jaypie/aws] Error fetching file from S3");
    logger.debug({ error });
    throw error;
  }
}

//
//
// Export
//

export default getS3FileBuffer;
