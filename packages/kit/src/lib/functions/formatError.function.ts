import HTTP from "../http.lib.js";
import JsonApiSerializer from "jsonapi-serializer";

interface JaypieError extends Error {
  isProjectError?: boolean;
  status?: number;
  title?: string;
  detail?: string;
  errors?: JaypieError[];
}

interface FormattedError {
  status: number;
  data: { errors: unknown[] };
}

function isMultiError(error: JaypieError): boolean {
  return Array.isArray(error.errors);
}

const formatError = (error: JaypieError): FormattedError => {
  if (!error.isProjectError) throw error;

  let errors: JaypieError[] = [error];
  if (isMultiError(error)) {
    errors = error.errors!;
  }

  const errorArray: unknown[] = [];
  let { status } = errors[0];
  errors.forEach((e) => {
    // If the errors aren't the same use a generic error
    if (status !== e.status) {
      // If they are both 4XX, use Bad Request
      if (
        Math.floor((status ?? 500) / 100) === 4 &&
        Math.floor((e.status ?? 500) / 100) === 4
      ) {
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

  return {
    status: status ?? HTTP.CODE.INTERNAL_ERROR,
    data: { errors: errorArray },
  };
};

export default formatError;
