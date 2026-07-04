import {
  LlmProgressCallback,
  LlmProgressEvent,
} from "../../types/LlmProvider.interface.js";
import { getLogger } from "../../util/index.js";

/**
 * Deliver a progress event to the caller's onProgress callback.
 * Errors thrown by the callback are logged and swallowed — progress
 * reporting must never interrupt the operate loop.
 */
export async function emitProgress({
  event,
  onProgress,
}: {
  event: LlmProgressEvent;
  onProgress?: LlmProgressCallback;
}): Promise<void> {
  if (!onProgress) {
    return;
  }
  try {
    await onProgress(event);
  } catch (error) {
    const log = getLogger();
    log.warn(`[operate] onProgress callback threw on "${event.type}" event`);
    log.var({ error });
  }
}
