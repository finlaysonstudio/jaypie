import { describe, expect, it } from "vitest";

// Subject
import { JAYPIE, log, PROJECT } from "../core.js";

//
//
// Run tests
//

describe("Jaypie Core", () => {
  it("Exposes constants", () => {
    expect(JAYPIE).toBeObject();
    expect(PROJECT.SPONSOR.FINLAYSON).toBe("finlaysonstudio");
  });
  it("Exports log", () => {
    expect(log).toBeObject();
    expect(log.debug).toBeFunction();
    expect(log.error).toBeFunction();
    expect(log.fatal).toBeFunction();
    expect(log.info).toBeFunction();
    expect(log.lib).toBeFunction();
    expect(log.tag).toBeFunction();
    expect(log.trace).toBeFunction();
    expect(log.untag).toBeFunction();
    expect(log.warn).toBeFunction();
    expect(log.with).toBeFunction();
  });
});
