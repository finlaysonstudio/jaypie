declare module "jest-json-schema" {
  interface JsonSchemaMatcherResult {
    message: () => string;
    pass: boolean;
  }

  interface JsonSchemaMatchers {
    toMatchSchema: (
      received: unknown,
      schema: object,
    ) => JsonSchemaMatcherResult;
  }

  export const matchers: JsonSchemaMatchers;
}
