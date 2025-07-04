# Jaypie construct helpers

packages/constructs/src/index.ts
packages/constructs/src/JaypieApiGateway.ts

I want to add some helper functions to the constructs library.
I think they should be built in packages/constructs/src/helpers.
They should be exported individually in index.
They should not be combined into a single helper object.

The first one should be:

```
export function projectEnvName(
  name: string,
  opts?: { env?: string; key?: string; nonce?: string },
) {
  const env = opts?.env ?? process.env.PROJECT_ENV ?? "build";
  const key = opts?.key ?? process.env.PROJECT_KEY ?? "project";
  const nonce = opts?.nonce ?? process.env.PROJECT_NONCE ?? "cfe2";
  return `${env}-${key}-${name}-${nonce}`;
}
```

Once that is available, use it in JaypieApiGateway
