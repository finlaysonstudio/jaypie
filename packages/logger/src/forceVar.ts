import { forceString } from "./utils";

export function forceVar(
  key: unknown,
  value?: unknown,
): Record<string, unknown> {
  if (typeof key === "undefined") {
    return {};
  }
  if (typeof key === "object" && key !== null) {
    if (Object.keys(key).length === 1) {
      return key as Record<string, unknown>;
    } else {
      return { value: key };
    }
  }
  const keyStr = forceString(key);
  if (typeof value === "undefined") {
    return { [keyStr]: "" };
  } else {
    return { [keyStr]: value };
  }
}
