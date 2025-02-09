import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [typescript()],
  external: [
    "@jaypie/cdk",
    "aws-cdk-lib",
    "aws-cdk-lib/aws-lambda",
    "aws-cdk-lib/aws-secretsmanager",
    "aws-cdk-lib/aws-sqs",
    "constructs",
  ],
};
