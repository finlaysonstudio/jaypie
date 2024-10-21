// Subject
const cfnOutput = require("../cfnOutput.function.js");

//
//
// Mock constants
//

//
//
// Mock modules
//

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("CfnOutput Function", () => {
  it("Works", () => {
    const response = cfnOutput();
    expect(response).not.toBeUndefined();
  });
});
