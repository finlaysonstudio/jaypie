const { CDK } = require("../constants.js");

describe("Constants", () => {
  it("Exports objects cor constants", () => {
    expect(CDK).not.toBeUndefined();
    expect(CDK).toBeObject();
  });
});
