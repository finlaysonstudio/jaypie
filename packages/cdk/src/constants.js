const CDK = {
  ACCOUNT: {
    DEVELOPMENT: "development",
    MANAGEMENT: "management",
    OPERATIONS: "operations",
    PRODUCTION: "production",
    SANDBOX: "sandbox",
    SECURITY: "security",
    STAGE: "stage",
  },
  BUILD: {
    CONFIG: {
      ALL: "all",
      API: "api",
      INFRASTRUCTURE: "infrastructure",
      NONE: "none",
      WEB: "web",
    },
    EPHEMERAL: "ephemeral",
    /**
     * @deprecated as even "ephemeral" builds have static assets (since 7/6/2024)
     */
    STATIC: "static",
  },
  CREATION: {
    CDK: "cdk",
    CLOUDFORMATION_TEMPLATE: "template",
    MANUAL: "manual",
  },
  DATADOG: {
    SITE: "datadoghq.com",
    LAYER: {
      // https://docs.datadoghq.com/serverless/aws_lambda/installation/nodejs/?tab=awscdk
      NODE: 112, // 112 on 6/28/2024
      EXTENSION: 58, // 58 on 6/28/2024
    },
  },
  DEFAULT: {
    REGION: "us-east-1",
  },
  DURATION: {
    EXPRESS_API: 30,
    LAMBDA_WORKER: 120,
  },
  ENV: {
    DEMO: "demo", // Mirror of production
    DEVELOPMENT: "development", // Internal most stable development space
    EPHEMERAL: "ephemeral", // Temporary builds using sandbox resources
    LOCAL: "local",
    /** @deprecated */ MAIN: "main", // Alias for development
    META: "meta", // For non-environment/infrastructure stacks
    PREVIEW: "preview", // External next thing to be released
    PRODUCTION: "production",
    TRAINING: "training", // aka "test"; mirror of production for external audiences
    RELEASE: "release", // Internal next thing to be released
    REVIEW: "review", // Internal place to collaborate on issues
    SANDBOX: "sandbox", // Internal build space with no guaranteed longevity
  },
  HOST: {
    APEX: "@",
  },
  IMPORT: {
    DATADOG_LOG_FORWARDER: "account-datadog-forwarder",
    DATADOG_ROLE: "account-datadog-role",
    DATADOG_SECRET: "account-datadog-secret",
    LOG_BUCKET: "account-log-bucket",
    OIDC_PROVIDER: "github-oidc-provider",
  },
  LAMBDA: {
    LOG_RETENTION: 90,
    MEMORY_SIZE: 1024,
  },
  PROJECT: {
    INFRASTRUCTURE: "infrastructure",
  },
  ROLE: {
    API: "api",
    DEPLOY: "deploy",
    HOSTING: "hosting",
    MONITORING: "monitoring",
    NETWORKING: "networking",
    PROCESSING: "processing",
    SECURITY: "security",
    STACK: "stack",
    STORAGE: "storage",
    TOY: "toy",
  },
  SERVICE: {
    DATADOG: "datadog",
    INFRASTRUCTURE: "infrastructure",
    LIBRARIES: "libraries",
    NONE: "none",
    TRACE: "trace",
  },
  TAG: {
    BUILD_DATE: "buildDate",
    BUILD_HEX: "buildHex",
    BUILD_NUMBER: "buildNumber",
    BUILD_TIME: "buildTime",
    BUILD_TYPE: "buildType",
    COMMIT: "commit",
    CREATION: "creation",
    ENV: "env",
    NONCE: "nonce",
    PROJECT: "project",
    ROLE: "role",
    SERVICE: "service",
    SPONSOR: "sponsor",
    STACK: "stack",
    STACK_SHA: "stackSha",
    VENDOR: "vendor",
    VERSION: "version",
  },
  VENDOR: {
    DATADOG: "datadog",
  },
};

module.exports = {
  CDK,
};
