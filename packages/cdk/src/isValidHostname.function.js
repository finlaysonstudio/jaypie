// In short the RFC 1035 standard for valid hostnames is:
// 1. Must be less than 253 characters
// 2. Must start with a letter
// 3. Must end with a letter or number
// 4. Can only contain letters, numbers, and hyphens
// 5. Last part of the domain must be at least 2 characters

function validPart(part) {
  if (!part.match(/^[a-z]/)) return false;
  if (!part.match(/[a-z0-9]$/)) return false;
  return /^[a-zA-Z0-9-]+$/.test(part);
}

module.exports = (hostname) => {
  // Check hostname is a string
  if (typeof hostname !== "string") return false;

  // Convert hostname to lowercase
  const check = hostname.toString().toLowerCase();

  // Check hostname is less than 253 characters
  if (check.length > 253) return false;

  // Split on dots
  const parts = check.split(".");

  // Check each part is validPart
  const validParts = parts.map(validPart);

  // Confirm all parts are valid
  if (!validParts.every((part) => part)) return false;

  // Confirm last part is at least 2 characters
  const lastPart = parts[parts.length - 1];
  if (lastPart.length < 2) return false;

  // Confirm last part is all letters
  if (!lastPart.match(/^[a-z]+$/)) return false;

  // This is a valid hostname
  return true;
};
