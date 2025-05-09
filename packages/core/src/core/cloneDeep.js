import lodashClone from "../lib/functions/cloneDeep";

//
//
// Export
//

export const cloneDeep = (value) => {
  try {
    return structuredClone(value);
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return lodashClone(value);
  }
};
