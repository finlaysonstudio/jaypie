const { CDK } = require("./constants.js");

function validPart(part) {
  if (!part.match(/^[a-z]/)) return false;
  if (!part.match(/[a-z0-9]$/)) return false;
  return /^[a-zA-Z0-9-]+$/.test(part);
}

module.exports = (subdomain) => {
  // Check subdomain is a string
  if (typeof subdomain !== "string") return false;

  // Special case for apex
  if (subdomain === CDK.HOST.APEX) return true;

  // Convert subdomain to lowercase
  const check = subdomain.toString().toLowerCase();

  // Check subdomain is less than 250 characters
  // We use 250 instead of 253 because we need to leave room for the dot top-level domain
  if (check.length > 250) return false;

  // Split on dots
  const parts = check.split(".");

  // Check each part is validPart
  const validParts = parts.map(validPart);

  // Confirm all parts are valid
  if (!validParts.every((part) => part)) return false;

  // Do not care if last part is at least 2 characters
  // Do not care if last part is all letters

  // This is a valid subdomain
  return true;
};
