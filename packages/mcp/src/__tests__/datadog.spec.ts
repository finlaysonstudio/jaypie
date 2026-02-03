import { describe, expect, it } from "vitest";

import { buildDatadogQuery } from "../suites/datadog/datadog.js";

describe("Datadog Query Building", () => {
  describe("buildDatadogQuery", () => {
    it("handles queries with quoted ARN values", () => {
      const options = {
        query:
          '@lambda.arn:"arn:aws:lambda:us-east-1:794038240169:function:my-function"',
        source: "lambda",
      };

      const result = buildDatadogQuery(options);

      // Should include the full query with quotes preserved
      expect(result).toContain(
        '@lambda.arn:"arn:aws:lambda:us-east-1:794038240169:function:my-function"',
      );
      expect(result).toContain("source:lambda");
    });

    it("preserves double quotes in query strings", () => {
      const options = {
        query: '@http.url:"https://example.com/path?param=value"',
      };

      const result = buildDatadogQuery(options);

      expect(result).toContain(
        '@http.url:"https://example.com/path?param=value"',
      );
    });

    it("handles complex queries with multiple quoted values", () => {
      const options = {
        query:
          '@lambda.arn:"arn:aws:lambda:us-east-1:123:function:test" AND @http.status_code:500',
      };

      const result = buildDatadogQuery(options);

      expect(result).toContain(
        '@lambda.arn:"arn:aws:lambda:us-east-1:123:function:test"',
      );
      expect(result).toContain("@http.status_code:500");
    });

    it("handles queries with escaped quotes", () => {
      const options = {
        query: '@message:"error: \\"invalid value\\""',
      };

      const result = buildDatadogQuery(options);

      expect(result).toContain('@message:"error: \\"invalid value\\""');
    });

    it("builds correct query with env and service", () => {
      const options = {
        env: "production",
        query: '@lambda.arn:"arn:aws:lambda:us-east-1:123:function:my-func"',
        service: "my-service",
        source: "lambda",
      };

      const result = buildDatadogQuery(options);

      expect(result).toContain("source:lambda");
      expect(result).toContain("env:production");
      expect(result).toContain("service:my-service");
      expect(result).toContain(
        '@lambda.arn:"arn:aws:lambda:us-east-1:123:function:my-func"',
      );
    });
  });

  describe("JSON serialization of queries", () => {
    it("correctly serializes query with quotes for Datadog API", () => {
      const query =
        'source:lambda @lambda.arn:"arn:aws:lambda:us-east-1:794038240169:function:test"';

      const requestBody = JSON.stringify({
        filter: {
          from: "now-1h",
          query,
          to: "now",
        },
        page: {
          limit: 50,
        },
        sort: "-timestamp",
      });

      // Parse it back to verify it's valid JSON
      const parsed = JSON.parse(requestBody);

      expect(parsed.filter.query).toBe(query);
      expect(parsed.filter.query).toContain(
        '@lambda.arn:"arn:aws:lambda:us-east-1:794038240169:function:test"',
      );
    });
  });
});
