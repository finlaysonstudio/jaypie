import { LEVEL } from "./constants";
import { getDatadogTransport } from "./datadogTransport";

export function forceString(value: unknown, defaultValue = ""): string {
  if (value === null) return "null";
  if (value === undefined) return String(defaultValue);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatAsJsonString(subject: unknown): string {
  const SPACES = 0;
  const UNUSED_PARAM = null;

  switch (typeof subject) {
    case "string":
      if (subject === "") return `""`;
      try {
        return JSON.stringify(JSON.parse(subject), UNUSED_PARAM, SPACES);
      } catch {
        return subject;
      }

    case "object":
      try {
        if (
          subject &&
          subject instanceof Object &&
          !Array.isArray(subject) &&
          subject.constructor &&
          subject.constructor !== Object &&
          "toString" in subject &&
          typeof subject.toString === "function"
        ) {
          return subject.toString();
        }
        return JSON.stringify(subject, UNUSED_PARAM, SPACES);
      } catch (error) {
        if (error instanceof TypeError) {
          const truncatedSubject = Object.keys(subject as object).reduce(
            (newSubject: Record<string, string>, key: string) => {
              const nextSubject = { ...newSubject };
              nextSubject[key] = String(
                (subject as Record<string, unknown>)[key],
              );
              return nextSubject;
            },
            {},
          );
          return formatAsJsonString(truncatedSubject);
        }
        throw error;
      }

    default:
      return String(subject);
  }
}

export function stringify(...params: unknown[]): string {
  if (params.length === 0) return "";
  if (params.length === 1) {
    return formatAsJsonString(params[0]);
  }

  const formatted = params.map(formatAsJsonString);
  return formatted.join(" ");
}

export function out(
  line: string | unknown,
  { level = "debug" }: { level?: string } = {},
): void {
  let lineStr: string;
  if (typeof line !== "string") {
    lineStr = stringify(line);
  } else {
    lineStr = line;
  }

  let outputFunction: (...args: unknown[]) => void;

  switch (level) {
    case LEVEL.INFO:
      outputFunction = console.info;
      break;
    case LEVEL.WARN:
      outputFunction = console.warn;
      break;
    case LEVEL.ERROR:
    case LEVEL.FATAL:
      outputFunction = console.error;
      break;
    case LEVEL.TRACE:
    case LEVEL.DEBUG:
      outputFunction = console.debug;
      break;
    default:
      outputFunction = console.log;
      break;
  }

  try {
    outputFunction(lineStr);
  } catch (error) {
    console.warn(error);
    console.log(lineStr);
  }

  try {
    const transport = getDatadogTransport();
    if (transport) {
      transport.send(lineStr, level);
    }
  } catch {
    // Transport errors must never affect logging
  }
}

export function parse(message: unknown): unknown {
  if (typeof message !== "string") {
    return message;
  }
  try {
    return JSON.parse(message);
  } catch {
    return message;
  }
}

export function parsesTo(message: unknown): {
  parses: boolean;
  message: unknown;
} {
  if (typeof message !== "string") {
    return {
      parses: false,
      message,
    };
  }
  try {
    return {
      parses: true,
      message: JSON.parse(message),
    };
  } catch {
    return {
      parses: false,
      message,
    };
  }
}
