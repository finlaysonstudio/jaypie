import { forceVar } from "./forceVar";
import { pipelines } from "./pipelines";

function keyValueToArray(keyValue: Record<string, unknown>): [string, unknown] {
  const key = Object.keys(keyValue)[0];
  return [key, keyValue[key]];
}

export function logVar(key: unknown, value?: unknown): Record<string, unknown> {
  let [k, v] = keyValueToArray(forceVar(key, value));

  for (const pipeline of pipelines) {
    if (k === pipeline.key) {
      v = pipeline.filter(v);
    }
  }

  return { [k]: v };
}
