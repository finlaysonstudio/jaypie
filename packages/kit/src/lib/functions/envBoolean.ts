import getObjectKeyCaseInsensitive from "./getObjectKeyCaseInsensitive.js";

interface EnvBooleanOptions {
  defaultValue?: boolean;
}

const envBoolean = (
  key: string,
  { defaultValue = undefined }: EnvBooleanOptions = {},
): boolean | undefined => {
  switch (
    String(
      getObjectKeyCaseInsensitive(process.env as Record<string, string>, key),
    ).toLowerCase()
  ) {
    case "true":
    case "1":
      return true;

    case "false":
    case "0":
      return false;

    default:
      return defaultValue;
  }
};

export default envBoolean;
