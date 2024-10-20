//
//
// Main
//

/** Flattens an array of one to just that value */
export default (value) => {
  // If the value is not an array, return the value
  if (!Array.isArray(value)) return value;

  // If the value is an array with one item, return that item
  if (value.length === 1) return value[0];

  // Return the array
  return value;
};
