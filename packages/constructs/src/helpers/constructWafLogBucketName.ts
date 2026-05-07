import { constructEnvName } from "./constructEnvName";

const AWS_WAF_LOGS_PREFIX = "aws-waf-logs-";
const S3_BUCKET_NAME_MAX_LENGTH = 63;

/**
 * Build a WAF log bucket name shaped like
 * `aws-waf-logs-${env}-${key}-${name}-waf-${nonce}` (or `-waf-` only when
 * `name` is empty). The `aws-waf-logs-` prefix is required by AWS WAF, and
 * `-${PROJECT_NONCE}` is preserved verbatim for uniqueness; the middle is
 * truncated when needed to fit S3's 63-char limit.
 */
export function constructWafLogBucketName(name?: string): string {
  const nonce = (process.env.PROJECT_NONCE ?? "cfe2").toLowerCase();
  const nonceSuffix = `-${nonce}`;
  const innerName = name ? `${name}-waf` : "waf";
  const middle = constructEnvName(innerName)
    .toLowerCase()
    .slice(0, -nonceSuffix.length);
  const maxMiddleLength =
    S3_BUCKET_NAME_MAX_LENGTH - AWS_WAF_LOGS_PREFIX.length - nonceSuffix.length;
  const truncated =
    middle.length > maxMiddleLength
      ? middle.slice(0, maxMiddleLength).replace(/-+$/, "")
      : middle;
  return `${AWS_WAF_LOGS_PREFIX}${truncated}${nonceSuffix}`;
}
