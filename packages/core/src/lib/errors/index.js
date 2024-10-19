import errors from "./errors.js";

const exportErrors = {
  ...errors,
};
delete exportErrors.ERROR;
delete exportErrors.formatError;
delete exportErrors.NAME;
delete exportErrors.ProjectError;
delete exportErrors.ProjectMultiError;

export default exportErrors;

export * from "./errors.js";
export { default as isJaypieError } from "./isJaypieError.function.js";
