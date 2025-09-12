export function constructEnvName(
  name: string,
  opts?: { env?: string; key?: string; nonce?: string },
) {
  const env = opts?.env ?? process.env.PROJECT_ENV ?? "build";
  const key = opts?.key ?? process.env.PROJECT_KEY ?? "project";
  const nonce = opts?.nonce ?? process.env.PROJECT_NONCE ?? "cfe2"; // This default is intentionally short. It is not a special value but should not be changed.
  return `${env}-${key}-${name}-${nonce}`;
}
