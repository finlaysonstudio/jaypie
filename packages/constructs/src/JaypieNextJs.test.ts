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

const mockAddEnvironment = vi.fn();

vi.mock("cdk-nextjs-standalone", () => ({
  Nextjs: vi.fn().mockImplementation(() => ({
    distribution: {
      distributionDomain: "d123456789.cloudfront.net",
    },
    imageOptimizationFunction: {},
    serverFunction: {
      lambdaFunction: {
        addEnvironment: mockAddEnvironment,
      },
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

  it("should accept domainProps: false for CloudFront-only deployment", () => {
    expect(() => {
      new JaypieNextJs(stack, "NextjsConstruct", {
        domainProps: false,
      });
    }).not.toThrow();
  });

  it("should have undefined domainName when domainProps is false", () => {
    const construct = new JaypieNextJs(stack, "NextjsConstruct", {
      domainProps: false,
    });
    expect(construct.domainName).toBeUndefined();
  });

  it("should set NEXT_PUBLIC_SITE_URL to CloudFront URL when domainProps is false", () => {
    mockAddEnvironment.mockClear();
    new JaypieNextJs(stack, "NextjsConstruct", {
      domainProps: false,
    });
    expect(mockAddEnvironment).toHaveBeenCalledWith(
      "NEXT_PUBLIC_SITE_URL",
      "https://d123456789.cloudfront.net",
    );
  });

  it("should have domainName when domainProps is not false", () => {
    const construct = new JaypieNextJs(stack, "NextjsConstruct", {
      domainName: "custom.example.com",
    });
    expect(construct.domainName).toBe("custom.example.com");
  });
});
