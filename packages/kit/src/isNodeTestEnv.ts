const NODE_ENV_TEST = "test";

export function isNodeTestEnv(): boolean {
  return process.env.NODE_ENV === NODE_ENV_TEST;
}
