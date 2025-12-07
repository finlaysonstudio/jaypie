declare module "jsonapi-serializer" {
  namespace JsonApiSerializer {
    class Error {
      errors: unknown[];
      constructor(error: unknown);
    }
  }

  export = JsonApiSerializer;
}
