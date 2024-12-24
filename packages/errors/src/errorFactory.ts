import { JaypieError } from "./baseErrors";

type ErrorConstructor = new (message?: string) => Error;

const proxyClassAsFunction = {
  apply: (target: ErrorConstructor, _thisArgument: any, argumentsList: any[]) => 
    new target(...argumentsList),
};

export function createErrorClass(
  defaultMessage: string,
  status: number,
  title: string,
  type: string
): ErrorConstructor {
  return new Proxy(
    class extends JaypieError {
      constructor(message = defaultMessage) {
        super(message, { status, title }, { _type: type });
      }
    },
    proxyClassAsFunction
  );
} 