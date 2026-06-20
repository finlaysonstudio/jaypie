export interface JaypieLambdaEnvOptions {
  initialEnvironment?: { [key: string]: string };
  serviceTag?: string;
}

export function jaypieLambdaEnv(options: JaypieLambdaEnvOptions = {}): {
  [key: string]: string;
} {
  const { initialEnvironment = {}, serviceTag } = options;

  // Start with empty environment - we'll only add valid values
  let environment: { [key: string]: string } = {};

  // First, add all valid string values from initialEnvironment
  Object.entries(initialEnvironment).forEach(([key, value]) => {
    if (typeof value === "string") {
      environment[key] = value;
    }
  });

  // Default environment values
  const defaultEnvValues: { [key: string]: string } = {
    AWS_LAMBDA_NODEJS_DISABLE_CALLBACK_WARNING: "true",
  };

  // Apply default environment values with user overrides
  Object.entries(defaultEnvValues).forEach(([key, defaultValue]) => {
    if (key in initialEnvironment) {
      const userValue = initialEnvironment[key];
      // If user passes a string, it's already added above
      // If user passes non-string falsy value, omit the key
      if (!userValue) {
        delete environment[key];
      }
      // Ignore non-string truthy values (key not added)
    } else {
      // No user override, use default value
      environment[key] = defaultValue;
    }
  });

  // Apply serviceTag as DD_SERVICE unless explicitly overridden.
  // Precedence: explicit environment > serviceTag > process.env.PROJECT_SERVICE
  if (serviceTag && !environment.DD_SERVICE) {
    environment.DD_SERVICE = serviceTag;
  }

  // Default environment variables from process.env if present
  const defaultEnvVars = [
    "DATADOG_API_KEY_ARN",
    "DD_VERSION",
    "LOG_LEVEL",
    "MODULE_LOGGER",
    "MODULE_LOG_LEVEL",
    "PROJECT_CHAOS",
    "PROJECT_COMMIT",
    "PROJECT_ENV",
    "PROJECT_KEY",
    "PROJECT_SECRET",
    "PROJECT_SERVICE",
    "PROJECT_SPONSOR",
    "PROJECT_VERSION",
  ];

  // Add default environment variables if they exist in process.env
  defaultEnvVars.forEach((envVar) => {
    if (process.env[envVar] && !environment[envVar]) {
      environment[envVar] = process.env[envVar]!;
    }
  });

  // Datadog LLM Observability: pass through DD_LLMOBS_ENABLED if set, and
  // DD_LLMOBS_ML_APP unless observability is explicitly disabled. Explicit
  // initialEnvironment values win over process.env, including for the gate.
  if (process.env.DD_LLMOBS_ENABLED && !environment.DD_LLMOBS_ENABLED) {
    environment.DD_LLMOBS_ENABLED = process.env.DD_LLMOBS_ENABLED;
  }
  const llmObsDisabled =
    environment.DD_LLMOBS_ENABLED === "false" ||
    environment.DD_LLMOBS_ENABLED === "0";
  if (
    process.env.DD_LLMOBS_ML_APP &&
    !llmObsDisabled &&
    !environment.DD_LLMOBS_ML_APP
  ) {
    environment.DD_LLMOBS_ML_APP = process.env.DD_LLMOBS_ML_APP;
  }

  return environment;
}
