import { CauseOptions, JaypieError } from "./baseErrors";

type ErrorConstructor = new (
  message?: string,
  options?: CauseOptions,
) => JaypieError;

type ErrorArguments = ConstructorParameters<ErrorConstructor>;

const proxyClassAsFunction = {
  apply: (
    target: ErrorConstructor,
    _thisArgument: unknown,
    argumentsList: ErrorArguments,
  ) => new target(...argumentsList),
};

export function createErrorClass(
  defaultMessage: string,
  status: number,
  title: string,
  type: string,
): ErrorConstructor {
  return new Proxy(
    // Status and title identify the class, so only `cause` is accepted here
    class extends JaypieError {
      constructor(message = defaultMessage, options: CauseOptions = {}) {
        super(message, { ...options, status, title }, { _type: type });
      }
    },
    proxyClassAsFunction,
  );
}
