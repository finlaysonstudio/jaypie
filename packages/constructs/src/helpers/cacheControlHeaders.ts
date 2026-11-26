import type * as cloudfront from "aws-cdk-lib/aws-cloudfront";

/**
 * Custom header entries for a response headers policy Cache-Control.
 * A string overrides the origin's header; false passes the origin's through.
 */
export function cacheControlHeaders(
  cacheControl: string | false,
): cloudfront.ResponseCustomHeader[] {
  if (cacheControl === false) return [];
  return [{ header: "Cache-Control", override: true, value: cacheControl }];
}
