import cloneDeep from "./cloneDeep.js";

interface SearchableObject {
  [key: string]: unknown;
  header?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

const getHeaderFrom = (headerKey: string, searchObject: unknown): unknown => {
  // Validate
  if (!searchObject || typeof searchObject !== "object") return undefined;

  try {
    const searchKey = headerKey.toLowerCase();

    const obj = cloneDeep(searchObject) as SearchableObject;
    // See if we find the key
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key.toLowerCase() === searchKey) {
        return obj[key];
      }
    }

    // Try a key called `header`
    if (obj.header && typeof obj.header === "object") {
      const response = getHeaderFrom(headerKey, obj.header);
      if (response !== undefined) return response;
    }

    // Try a key called `headers`
    if (obj.headers && typeof obj.headers === "object") {
      const response = getHeaderFrom(headerKey, obj.headers);
      if (response !== undefined) return response;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    //
  }

  // Return undefined
  return undefined;
};

export default getHeaderFrom;
