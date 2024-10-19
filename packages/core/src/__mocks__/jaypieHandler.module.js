import { vi } from "vitest";

function init() {
  // Simulate the module
  // eslint-disable-next-line no-unused-vars
  const module = vi.fn((handler, options) => {
    return (...args) => handler(...args);
  });

  // return the module
  return module;
}

export default init();
