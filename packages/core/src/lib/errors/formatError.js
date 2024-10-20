import HTTP from "../http.lib.js";
import JsonApiSerializer from "jsonapi-serializer";

//
//
// Private Functions
//

function isMultiError(error) {
  return Array.isArray(error.errors);
}

//
//
// Function Definition
//

const formatError = (error) => {
  if (!error.isProjectError) throw error;

  let errors = [error];
  if (isMultiError(error)) {
    errors = error.errors;
  }

  const errorArray = [];
  let status;
  errors.forEach((e) => {
    if (!status) status = e.status;
    // If the errors aren't the same use a generic error
    if (status !== e.status) {
      // If they are both 4XX, use Bad Request
      if (Math.floor(status / 100) === 4 && Math.floor(e.status / 100) === 4) {
        status = HTTP.CODE.BAD_REQUEST;
      } else {
        // Otherwise, use internal server error
        status = HTTP.CODE.INTERNAL_ERROR;
      }
    }

    // Format the error
    const formatted = new JsonApiSerializer.Error(e);
    // But only pluck out the inner part of the array
    errorArray.push(formatted.errors[0]);
  });
  // If for some reason the error array was empty
  if (!status) status = HTTP.CODE.INTERNAL_ERROR;

  return {
    status,
    data: { errors: errorArray },
  };
};

//
//
// Export
//

export default formatError;
