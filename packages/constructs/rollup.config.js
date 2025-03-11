import typescript from "@rollup/plugin-typescript";

export default [
  // ES modules version
  {
    input: "src/index.ts",
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
      "@jaypie/cdk",
      "aws-cdk-lib",
      "aws-cdk-lib/aws-iam",
      "aws-cdk-lib/aws-lambda-event-sources",
      "aws-cdk-lib/aws-lambda",
      "aws-cdk-lib/aws-logs",
      "aws-cdk-lib/aws-route53",
      "aws-cdk-lib/aws-secretsmanager",
      "aws-cdk-lib/aws-sqs",
      "constructs",
    ],
  },
  // CommonJS version
  {
    input: "src/index.ts",
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
      "@jaypie/cdk",
      "aws-cdk-lib",
      "aws-cdk-lib/aws-iam",
      "aws-cdk-lib/aws-lambda-event-sources",
      "aws-cdk-lib/aws-lambda",
      "aws-cdk-lib/aws-logs",
      "aws-cdk-lib/aws-route53",
      "aws-cdk-lib/aws-secretsmanager",
      "aws-cdk-lib/aws-sqs",
      "constructs",
    ],
  },
];
