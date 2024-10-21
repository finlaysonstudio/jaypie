const isValidHostname = require("../isValidHostname.function.js");

//
//
// Run tests
//

describe("Is Valid Hostname Function", () => {
  it("Works", () => {
    const response = isValidHostname();
    expect(response).not.toBeUndefined();
    expect(response).toBe(false);
  });
  it("Returns false for non-string", () => {
    const response = isValidHostname(123);
    expect(response).toBe(false);
  });
  it("Returns false for empty string", () => {
    const response = isValidHostname("");
    expect(response).toBe(false);
  });
  it("Returns false for invalid hostname", () => {
    const response = isValidHostname("123");
    expect(response).toBe(false);
  });
  it("Returns true for valid hostname", () => {
    const response = isValidHostname("example.com");
    expect(response).toBe(true);
  });
  it("Returns true for localhost", () => {
    const response = isValidHostname("localhost");
    expect(response).toBe(true);
  });
  it("Returns true for subdomain", () => {
    const response = isValidHostname("subdomain.example.com");
    expect(response).toBe(true);
  });
  it("Returns false for invalid subdomain", () => {
    const response = isValidHostname("sub_domain.example.com");
    expect(response).toBe(false);
  });
});
