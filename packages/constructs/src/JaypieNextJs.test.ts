import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Stack, App } from "aws-cdk-lib";

vi.mock("./helpers", () => ({
  addDatadogLayers: vi.fn(),
  envHostname: vi.fn(() => "test.example.com"),
  jaypieLambdaEnv: vi.fn(() => ({ NODE_ENV: "test" })),
  resolveEnvironment: vi.fn((env) => (Array.isArray(env) ? {} : env || {})),
  resolveHostedZone: vi.fn(() => ({ hostedZoneId: "Z123456789" })),
  resolveParamsAndSecrets: vi.fn(() => ({})),
  resolveSecrets: vi.fn(() => []),
}));

vi.mock("cdk-nextjs-standalone", () => ({
  Nextjs: vi.fn().mockImplementation(() => ({
    imageOptimizationFunction: {},
    serverFunction: {
      lambdaFunction: {},
    },
  })),
}));

import { JaypieNextJs } from "./JaypieNextJs";

describe("JaypieNextJs", () => {
  let app: App;
  let stack: Stack;
  let originalEnv: typeof process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env.CDK_ENV_DATADOG_API_KEY_ARN;
    app = new App();
    stack = new Stack(app, "TestStack");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should instantiate without throwing", () => {
    expect(() => {
      new JaypieNextJs(stack, "NextjsConstruct");
    }).not.toThrow();
  });

  it("should be an instance of JaypieNextJs", () => {
    const construct = new JaypieNextJs(stack, "NextjsConstruct");
    expect(construct).toBeInstanceOf(JaypieNextJs);
    expect(construct.constructor.name).toBe("JaypieNextJs");
  });

  it("should accept props without throwing", () => {
    expect(() => {
      new JaypieNextJs(stack, "NextjsConstruct", {
        nextjsPath: "../custom-app",
        domainName: "custom.domain.com",
      });
    }).not.toThrow();
  });

  it("should accept hostedZone prop without throwing", () => {
    expect(() => {
      new JaypieNextJs(stack, "NextjsConstruct", {
        hostedZone: "Z123456789",
      });
    }).not.toThrow();
  });
});
