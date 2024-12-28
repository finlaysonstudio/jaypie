declare module "@jaypie/express" {
  // Types from the Express framework that we need
  interface Request {
    locals?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface Response {
    status?: (code: number) => Response;
    json?: (data: unknown) => void;
    send?: (data?: unknown) => void;
    socket?: unknown;
    constructor: {
      name: string;
    };
    [key: string]: unknown;
  }

  // Handler Types
  export type ExpressHandler = (
    req: Request,
    res: Response,
    ...args: unknown[]
  ) => Promise<unknown>;

  export interface ExpressHandlerOptions {
    locals?: {
      [key: string]:
        | unknown
        | ((req: Request, res: Response) => Promise<unknown>);
    };
    setup?: Array<
      (req: Request, res: Response, ...args: unknown[]) => Promise<void>
    >;
    teardown?: Array<
      (req: Request, res: Response, ...args: unknown[]) => Promise<void>
    >;
    unavailable?: boolean;
    validate?: Array<
      (req: Request, res: Response, ...args: unknown[]) => Promise<boolean>
    >;
  }

  export type ExpressHandlerProps = ExpressHandlerOptions;

  // Main Function
  export function expressHandler(
    handlerOrOptions: ExpressHandler | ExpressHandlerOptions,
    optionsOrHandler?: ExpressHandlerOptions | ExpressHandler,
  ): ExpressHandler;
}
