import { describe, expect, it } from "vitest";

import * as repokit from "../index";

describe("@jaypie/repokit", () => {
  it("exports dotenv config function", () => {
    expect(repokit.config).toBeDefined();
    expect(typeof repokit.config).toBe("function");
  });

  it("exports rimraf function", () => {
    expect(repokit.rimraf).toBeDefined();
    expect(typeof repokit.rimraf).toBe("function");
  });
});
