import { Request, Response, NextFunction } from "express";
import { JaypieHandlerOptions } from "@jaypie/core";

export const EXPRESS: {
  PATH: {
    ANY: "*";
    ID: "/:id";
    ROOT: RegExp;
  };
};

export interface CorsConfig {
  origins?: string | string[];
  overrides?: Record<string, unknown>;
}

export interface ExpressHandlerOptions extends JaypieHandlerOptions {
  locals?: Record<string, unknown>;
  name?: string;
  setup?: ((req: Request, res: Response) => Promise<void>)[];
  teardown?: ((req: Request, res: Response) => Promise<void>)[];
  unavailable?: boolean;
}

export function cors(
  config?: CorsConfig,
): (req: Request, res: Response, next: NextFunction) => void;

export function expressHandler<T>(
  handler: (req: Request, res: Response, ...params: unknown[]) => Promise<T>,
  options?: ExpressHandlerOptions,
): (req: Request, res: Response, ...params: unknown[]) => Promise<T>;

export function expressHttpCodeHandler(
  statusCode?: number,
  context?: ExpressHandlerOptions,
): (req: Request, res: Response) => Promise<Record<string, unknown> | null>;

// Pre-configured routes
export const badRequestRoute: (
  req: Request,
  res: Response,
) => Promise<Record<string, unknown>>;
export const echoRoute: (
  req: Request,
  res: Response,
) => Promise<Record<string, unknown>>;
export const forbiddenRoute: (
  req: Request,
  res: Response,
) => Promise<Record<string, unknown>>;
export const goneRoute: (
  req: Request,
  res: Response,
) => Promise<Record<string, unknown>>;
export const methodNotAllowedRoute: (
  req: Request,
  res: Response,
) => Promise<Record<string, unknown>>;
export const noContentRoute: (req: Request, res: Response) => Promise<null>;
export const notFoundRoute: (
  req: Request,
  res: Response,
) => Promise<Record<string, unknown>>;
export const notImplementedRoute: (
  req: Request,
  res: Response,
) => Promise<never>;
