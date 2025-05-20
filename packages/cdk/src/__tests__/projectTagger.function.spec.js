const { CDK } = require("../constants.js");

// Subject
const projectTagger = require("../projectTagger.function.js");

//
//
// Mock modules
//

const add = jest.fn();
const of = jest.fn(() => ({ add }));
const cdk = {
  Tags: {
    of,
  },
};

afterEach(() => {
  jest.clearAllMocks();
});

//
//
// Run tests
//

describe("ProjectTagger Function", () => {
  it("Works", () => {
    const response = projectTagger({
      cdk,
      stack: "MOCK_STACK",
      stackName: "MOCK_STACK_NAME",
    });
    expect(response).not.toBeUndefined();
    expect(response).toBeTrue();
  });
  it("Calls `of` as many times as `add`", () => {
    projectTagger({
      cdk,
      stack: "MOCK_STACK",
      stackName: "MOCK_STACK_NAME",
    });
    const ofCalls = of.mock.calls.length;
    const addCalls = add.mock.calls.length;
    expect(ofCalls).toBe(addCalls);
  });
  it("Tags stackName", () => {
    projectTagger({
      cdk,
      stack: "MOCK_STACK",
      stackName: "MOCK_STACK_NAME",
    });
    expect(of).toHaveBeenCalledWith("MOCK_STACK");
    expect(add).toHaveBeenCalledWith(CDK.TAG.STACK, "MOCK_STACK_NAME");
  });
  it("Will not tag stackName if not passed", () => {
    const add = jest.fn();
    const of = jest.fn(() => ({ add }));
    const cdk = {
      Tags: {
        of,
      },
    };

    const response = projectTagger({
      cdk,
      stack: "MOCK_STACK",
    });
    expect(response).not.toBeUndefined();
    expect(response).toBeTrue();
    expect(of).toHaveBeenCalledWith("MOCK_STACK");
    expect(add).not.toHaveBeenCalledWith(CDK.TAG.STACK, "MOCK_STACK_NAME");
  });
  it("Throws error if stack is not passed", () => {
    try {
      projectTagger({
        cdk,
        stackName: "MOCK_STACK_NAME",
      });
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error.isProjectError).toBeTrue();
    }
    expect.assertions(1);
  });
  it("Throws error if cdk is not passed", () => {
    try {
      projectTagger({
        stack: "MOCK_STACK",
        stackName: "MOCK_STACK_NAME",
      });
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error.isProjectError).toBeTrue();
    }
    expect.assertions(1);
  });
});
