import HTTP from "../http.lib.js";

interface JaypieError extends Error {
  isProjectError?: boolean;
  status?: number;
  title?: string;
  detail?: string;
  errors?: JaypieError[];
}

interface JsonApiError {
  status: string;
  title?: string;
  detail?: string;
}

interface FormattedError {
  status: number;
  data: { errors: JsonApiError[] };
}

function isMultiError(error: JaypieError): boolean {
  return Array.isArray(error.errors);
}

function toJsonApiError(error: JaypieError): JsonApiError {
  const jsonApiError: JsonApiError = {
    status: String(error.status ?? HTTP.CODE.INTERNAL_ERROR),
  };
  if (error.title) {
    jsonApiError.title = error.title;
  }
  if (error.detail) {
    jsonApiError.detail = error.detail;
  }
  return jsonApiError;
}

const formatError = (error: JaypieError): FormattedError => {
  if (!error.isProjectError) throw error;

  let errors: JaypieError[] = [error];
  if (isMultiError(error)) {
    errors = error.errors!;
  }

  const errorArray: JsonApiError[] = [];
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

    errorArray.push(toJsonApiError(e));
  });

  return {
    status: status ?? HTTP.CODE.INTERNAL_ERROR,
    data: { errors: errorArray },
  };
};

export default formatError;
