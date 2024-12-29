import { JaypieError } from "./baseErrors";

type ErrorConstructor = new (message?: string) => JaypieError;

const proxyClassAsFunction = {
  apply: (
    target: ErrorConstructor,
    _thisArgument: unknown,
    argumentsList: Array<string | undefined>,
  ) => new target(...argumentsList),
};

export function createErrorClass(
  defaultMessage: string,
  status: number,
  title: string,
  type: string,
): ErrorConstructor {
  return new Proxy(
    class extends JaypieError {
      constructor(message = defaultMessage) {
        super(message, { status, title }, { _type: type });
      }
    },
    proxyClassAsFunction,
  );
}
