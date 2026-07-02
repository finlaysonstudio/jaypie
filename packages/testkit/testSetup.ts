import { expect } from "vitest";
import matchers from "./src/matchers.module.js";

// Add all matchers (Jaypie custom + absorbed extended matchers) to Vitest's expect
expect.extend(matchers);
