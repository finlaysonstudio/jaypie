export interface JaypieLambdaEnvOptions {
  initialEnvironment?: { [key: string]: string };
}

export function jaypieLambdaEnv(options: JaypieLambdaEnvOptions = {}): {
  [key: string]: string;
} {
  const { initialEnvironment = {} } = options;

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

  // Default environment variables from process.env if present
  const defaultEnvVars = [
    "DATADOG_API_KEY_ARN",
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

  return environment;
}
