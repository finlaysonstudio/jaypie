import { expect } from "vitest";

import matchers from "./matchers.module";

// Add all matchers (Jaypie custom + absorbed extended matchers) to Vitest's
// expect. Published as `@jaypie/testkit/testSetup` for `test.setupFiles`.
expect.extend(matchers);
