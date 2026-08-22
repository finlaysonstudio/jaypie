import { CauseOptions, JaypieError } from "./baseErrors";
import { isJaypieError } from "./isJaypieError";

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
  // Status and title identify the class, so only `cause` is accepted here
  const GeneratedError = class extends JaypieError {
    constructor(message = defaultMessage, options: CauseOptions = {}) {
      super(message, { ...options, status, title }, { _type: type });
    }
  };
  const ProxiedError = new Proxy(GeneratedError, proxyClassAsFunction);
  // The package publishes an ESM build and a CommonJS build, and a repository
  // mixing both formats loads both. Each build owns its own class object, so
  // prototype identity cannot answer `instanceof` across the boundary. Match on
  // the structural marker instead, which also holds when two copies of the
  // package are installed. A subclass keeps ordinary prototype semantics so
  // callers can still distinguish their own errors from these.
  Object.defineProperty(GeneratedError, Symbol.hasInstance, {
    configurable: true,
    value: function hasInstance(this: unknown, instance: unknown): boolean {
      if (this !== ProxiedError && this !== GeneratedError) {
        return Function.prototype[Symbol.hasInstance].call(this, instance);
      }
      return (
        isJaypieError(instance) &&
        (instance as { _type?: string })._type === type
      );
    },
  });
  return ProxiedError;
}
