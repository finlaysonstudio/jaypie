export function constructStackName(key?: string): string {
  if (!key) {
    return `cdk-${process.env.PROJECT_SPONSOR}-${process.env.PROJECT_KEY}-${process.env.PROJECT_ENV}-${process.env.PROJECT_NONCE}`;
  } else {
    return `cdk-${process.env.PROJECT_SPONSOR}-${process.env.PROJECT_KEY}-${process.env.PROJECT_ENV}-${process.env.PROJECT_NONCE}-${key}`;
  }
}
