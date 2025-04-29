import { expect } from "vitest";
import matchers from "./src/matchers.module.js";

// Add all matchers (including jest-extended) to Vitest's expect
expect.extend(matchers);
