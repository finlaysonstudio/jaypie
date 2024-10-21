const { CDK } = require("../constants.js");

// Subject
const isValidSubdomain = require("../isValidSubdomain.function.js");

//
//
// Run tests
//

describe("isValidSubdomain", () => {
  it("Works", () => {
    const response = isValidSubdomain();
    expect(response).not.toBeUndefined();
    expect(response).toBeBoolean();
  });
  it("Returns true for valid subdomains", () => {
    expect(isValidSubdomain("project")).toBeTrue();
    expect(isValidSubdomain("mayhem")).toBeTrue();
    expect(isValidSubdomain("a-b-c")).toBeTrue();
    expect(isValidSubdomain(CDK.HOST.APEX)).toBeTrue();
    expect(isValidSubdomain("@")).toBeTrue();
  });
  it("Returns false for invalid subdomains", () => {
    expect(isValidSubdomain("hello_world")).toBeFalse();
    expect(isValidSubdomain("email@project.com")).toBeFalse();
    expect(isValidSubdomain("")).toBeFalse();
    expect(isValidSubdomain("project.")).toBeFalse();
    expect(isValidSubdomain(".project")).toBeFalse();
    expect(isValidSubdomain("project..com")).toBeFalse();
    expect(isValidSubdomain("project.com.")).toBeFalse();
    expect(isValidSubdomain("project..com.")).toBeFalse();
    expect(isValidSubdomain("project.com.")).toBeFalse();
    expect(isValidSubdomain("project..com")).toBeFalse();
  });
});
