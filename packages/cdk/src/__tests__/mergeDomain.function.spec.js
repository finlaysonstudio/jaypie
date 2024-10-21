const { CDK } = require("../constants.js");

// Subject
const mergeDomain = require("../mergeDomain.function.js");

//
//
// Run tests
//

describe("Merge Domain Function", () => {
  it("Merges domains", () => {
    const response = mergeDomain("subdomain", "hosted.zone");
    expect(response).toBe("subdomain.hosted.zone");
  });
  it("Returns hosted zone if apex is passed", () => {
    const response = mergeDomain(CDK.HOST.APEX, "hosted.zone");
    expect(response).toBe("hosted.zone");
    expect(CDK.HOST.APEX).toBe("@");
  });
  it("Throws error if hosted zone is not passed", () => {
    expect(() => mergeDomain("subdomain")).toThrow();
  });
  it("Returns hosted zone if subdomain is not passed", () => {
    const response = mergeDomain(undefined, "hosted.zone");
    expect(response).toBe("hosted.zone");
  });
  it("Returns hosted zone if subdomain is empty", () => {
    const response = mergeDomain("", "hosted.zone");
    expect(response).toBe("hosted.zone");
  });
});
