const getObjectKeyCaseInsensitive = (
  object: Record<string, unknown>,
  key: string,
): unknown => {
  const keys = Object.keys(object);

  // If we have this key, return it
  if (keys.includes(key)) return object[key];

  // If we don't have this key, do a case-insensitive search for it
  for (let i = 0; i < keys.length; i += 1) {
    const myKey = keys[i];
    if (myKey.toLowerCase() === key.toLowerCase()) {
      return object[myKey];
    }
  }

  return undefined;
};

export default getObjectKeyCaseInsensitive;
