import { vi } from "vitest";
import { LogMock } from "./types.js";

export const mockLogFactory = (): LogMock => ({
  debug: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  info: vi.fn(),
  init: vi.fn(),
  lib: vi.fn(),
  tag: vi.fn(),
  trace: vi.fn(),
  untag: vi.fn(),
  var: vi.fn(),
  warn: vi.fn(),
  with: vi.fn(),
});

export const spyLog = (log: LogMock): void => {
  const original = { ...log };
  Object.keys(original).forEach((key) => {
    if (typeof original[key as keyof LogMock] === "function") {
      vi.spyOn(log, key as keyof LogMock);
    }
  });
};

export const restoreLog = (log: LogMock): void => {
  Object.keys(log).forEach((key) => {
    if (typeof log[key as keyof LogMock] === "function") {
      vi.restoreAllMocks();
    }
  });
}; 