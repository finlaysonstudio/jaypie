import typescript from "@rollup/plugin-typescript";

// Filter out TS2307 warnings for @jaypie/* packages (external workspace dependencies)
const onwarn = (warning, defaultHandler) => {
  if (
    warning.plugin === "typescript" &&
    warning.message.includes("@jaypie/")
  ) {
    return;
  }
  defaultHandler(warning);
};

export default [
  // ES modules version
  {
    input: "src/index.ts",
    onwarn,
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/esm",
      }),
    ],
    external: [
      "@jaypie/errors",
      "aws-cdk-lib",
      "aws-cdk-lib/aws-apigateway",
      "aws-cdk-lib/aws-certificatemanager",
      "aws-cdk-lib/aws-cloudfront",
      "aws-cdk-lib/aws-cloudfront-origins",
      "aws-cdk-lib/aws-cloudtrail",
      "aws-cdk-lib/aws-events",
      "aws-cdk-lib/aws-events-targets",
      "aws-cdk-lib/aws-iam",
      "aws-cdk-lib/aws-lambda",
      "aws-cdk-lib/aws-lambda-event-sources",
      "aws-cdk-lib/aws-logs",
      "aws-cdk-lib/aws-logs-destinations",
      "aws-cdk-lib/aws-route53",
      "aws-cdk-lib/aws-route53-targets",
      "aws-cdk-lib/aws-s3",
      "aws-cdk-lib/aws-s3-notifications",
      "aws-cdk-lib/aws-sam",
      "aws-cdk-lib/aws-secretsmanager",
      "aws-cdk-lib/aws-sqs",
      "aws-cdk-lib/aws-sso",
      "cdk-nextjs-standalone",
      "constructs",
      "datadog-cdk-constructs-v2",
      "path",
    ],
  },
  // CommonJS version
  {
    input: "src/index.ts",
    onwarn,
    output: {
      dir: "dist/cjs",
      format: "cjs",
      sourcemap: true,
      exports: "named",
      entryFileNames: "[name].cjs",
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/cjs",
      }),
    ],
    external: [
      "@jaypie/errors",
      "aws-cdk-lib",
      "aws-cdk-lib/aws-apigateway",
      "aws-cdk-lib/aws-certificatemanager",
      "aws-cdk-lib/aws-cloudfront",
      "aws-cdk-lib/aws-cloudfront-origins",
      "aws-cdk-lib/aws-cloudtrail",
      "aws-cdk-lib/aws-events",
      "aws-cdk-lib/aws-events-targets",
      "aws-cdk-lib/aws-iam",
      "aws-cdk-lib/aws-lambda",
      "aws-cdk-lib/aws-lambda-event-sources",
      "aws-cdk-lib/aws-logs",
      "aws-cdk-lib/aws-logs-destinations",
      "aws-cdk-lib/aws-route53",
      "aws-cdk-lib/aws-route53-targets",
      "aws-cdk-lib/aws-s3",
      "aws-cdk-lib/aws-s3-notifications",
      "aws-cdk-lib/aws-sam",
      "aws-cdk-lib/aws-secretsmanager",
      "aws-cdk-lib/aws-sqs",
      "aws-cdk-lib/aws-sso",
      "cdk-nextjs-standalone",
      "constructs",
      "datadog-cdk-constructs-v2",
      "path",
    ],
  },
];
