import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";

//
//
// Constants
//

// SSM parameter names allow a-z, A-Z, 0-9, and the characters . - _ /
const UNSAFE_CHARACTERS = /[^a-zA-Z0-9._-]/g;

//
//
// Helpers
//

function slug(value: string): string {
  return value.replace(UNSAFE_CHARACTERS, "-");
}

/**
 * The construct's path with its stack prefix removed.
 *
 * Construct ids alone are not unique: `JaypieQueuedLambda` names its inner
 * lambda "Function", so two queued lambdas in one stack would collide. The
 * path within the stack is unique by definition.
 */
function stackRelativePath(scope: Construct): string {
  const stackPath = Stack.of(scope).node.path;
  const path = scope.node.path;
  const relative =
    path === stackPath
      ? scope.node.id
      : path.startsWith(`${stackPath}/`)
        ? path.slice(stackPath.length + 1)
        : path;
  return relative.split("/").map(slug).join("/");
}

//
//
// Main
//

/**
 * Build an SSM parameter path scoped by the Jaypie environment convention and
 * the construct's location within its stack.
 *
 * @example
 * // PROJECT_ENV=sandbox PROJECT_KEY=myapp PROJECT_NONCE=a1b2
 * constructParameterName(lambda, { name: "variables" })
 * // => "/sandbox/myapp/a1b2/Api/Function/variables"
 */
export function constructParameterName(
  scope: Construct,
  {
    env = process.env.PROJECT_ENV ?? "build",
    key = process.env.PROJECT_KEY ?? "project",
    name,
    nonce = process.env.PROJECT_NONCE ?? "cfe2", // This default is intentionally short. It is not a special value but should not be changed.
  }: { env?: string; key?: string; name?: string; nonce?: string } = {},
): string {
  const segments = [
    slug(env),
    slug(key),
    slug(nonce),
    stackRelativePath(scope),
  ];
  if (name) {
    segments.push(slug(name));
  }
  return `/${segments.join("/")}`;
}
