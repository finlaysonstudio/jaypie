export function constructEnvName(
  name: string,
  opts?: { env?: string; key?: string; nonce?: string },
) {
  const env = opts?.env ?? process.env.PROJECT_ENV ?? "build";
  const key = opts?.key ?? process.env.PROJECT_KEY ?? "project";
  const nonce = opts?.nonce ?? process.env.PROJECT_NONCE ?? "cfe2";
  return `${env}-${key}-${name}-${nonce}`;
}