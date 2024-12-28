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
  export type ExpressHandler<TLocals = unknown> = (
    req: Request,
    res: Response,
    ...args: unknown[]
  ) => Promise<unknown>;

  export interface ExpressHandlerOptions<TLocals = unknown> {
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

  export type ExpressHandlerProps<TLocals = unknown> =
    ExpressHandlerOptions<TLocals>;

  // Main Function
  export function expressHandler<TLocals = unknown>(
    handlerOrOptions: ExpressHandler<TLocals> | ExpressHandlerOptions<TLocals>,
    optionsOrHandler?: ExpressHandlerOptions<TLocals> | ExpressHandler<TLocals>,
  ): ExpressHandler<TLocals>;
}
