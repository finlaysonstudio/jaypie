import cloneDeep from "lodash.clonedeep";

//
//
// Main
//

const getHeaderFrom = (headerKey, searchObject) => {
  // Validate
  if (!searchObject || typeof searchObject !== "object") return undefined;

  try {
    const searchKey = headerKey.toLowerCase();
    // eslint-disable-next-line no-param-reassign
    searchObject = cloneDeep(searchObject);

    // See if we find the key
    const keys = Object.keys(searchObject);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key.toLowerCase() === searchKey) {
        return searchObject[key];
      }
    }

    // Try a key called `header`
    if (searchObject.header && typeof searchObject.header === "object") {
      const response = getHeaderFrom(headerKey, searchObject.header);
      if (response !== undefined) return response;
    }

    // Try a key called `headers`
    if (searchObject.headers && typeof searchObject.headers === "object") {
      const response = getHeaderFrom(headerKey, searchObject.headers);
      if (response !== undefined) return response;
    }
  } catch (error) {
    //
  }

  // Return undefined
  return undefined;
};

//
//
// Export
//

export default getHeaderFrom;
