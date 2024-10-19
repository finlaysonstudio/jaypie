//
//
// Constants
//

//
//
// Helper Functions
//

function isError(item) {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  if (item instanceof Error) {
    return true;
  }
  if (item.isProjectError) {
    return true;
  }
  return false;
}

// * At this point we _assume_ the key was matched
function filterErrorVar(item) {
  if (!isError(item)) {
    return item;
  }
  const newItem = {
    message: item.message,
    name: item.name,
  };
  if (item.cause) {
    newItem.cause = item.cause;
  }
  if (item.stack) {
    newItem.stack = item.stack;
  }
  if (item.isProjectError) {
    newItem.isProjectError = item.isProjectError;
    newItem.title = item.title;
    newItem.detail = item.detail;
    newItem.status = item.status;
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
