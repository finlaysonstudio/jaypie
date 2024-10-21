const {
  CDK,
  cfnOutput,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
  projectTagger,
} = require("../index.js");

//
//
// Run tests
//

describe("index", () => {
  it("Exports objects for constants", () => {
    expect(CDK).not.toBeUndefined();
    expect(CDK).toBeObject();
  });
  it("Exports function for cfnOutput", () => {
    expect(cfnOutput).not.toBeUndefined();
    expect(cfnOutput).toBeFunction();
  });
  it("Exports function for isValidHostname", () => {
    expect(isValidHostname).not.toBeUndefined();
    expect(isValidHostname).toBeFunction();
  });
  it("Exports function for isValidSubdomain", () => {
    expect(isValidSubdomain).not.toBeUndefined();
    expect(isValidSubdomain).toBeFunction();
  });
  it("Exports function for mergeDomain", () => {
    expect(mergeDomain).not.toBeUndefined();
    expect(mergeDomain).toBeFunction();
  });
  it("Exports function for projectTagger", () => {
    expect(projectTagger).not.toBeUndefined();
    expect(projectTagger).toBeFunction();
  });
});
