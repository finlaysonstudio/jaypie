//
//
// Types
//

interface JaypieError extends Error {
  isProjectError?: boolean;
  title?: string;
  detail?: string;
  status?: number;
  cause?: unknown;
}

interface FilteredError {
  message: string;
  name: string;
  cause?: unknown;
  stack?: string;
  isProjectError?: boolean;
  title?: string;
  detail?: string;
  status?: number;
}

//
//
// Helper Functions
//

function isError(item: unknown): item is JaypieError {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  if (item instanceof Error) {
    return true;
  }
  if ((item as JaypieError).isProjectError) {
    return true;
  }
  return false;
}

// * At this point we _assume_ the key was matched
function filterErrorVar(item: unknown): FilteredError | unknown {
  if (!isError(item)) {
    return item;
  }
  const newItem: FilteredError = {
    message: item.message,
    name: item.name,
  };
  if (item.cause) {
    newItem.cause = item.cause;
  }
  if (item.stack) {
    newItem.stack = item.stack;
  }
  if ((item as JaypieError).isProjectError) {
    const jaypieError = item as JaypieError;
    newItem.isProjectError = jaypieError.isProjectError;
    newItem.title = jaypieError.title;
    newItem.detail = jaypieError.detail;
    newItem.status = jaypieError.status;
  }
  return newItem;
}

//
//
// Export
//

export default {
  key: "error",
  filter: filterErrorVar,
};
