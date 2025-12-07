import { loadPackage } from "./loadPackage.js";
import type * as ExpressTypes from "@jaypie/express";

type ExpressModule = typeof ExpressTypes;

// Re-export types (these don't require the package at runtime)
export type {
  CorsConfig,
  ExpressHandlerLocals,
  ExpressHandlerOptions,
  JaypieHandlerSetup,
  JaypieHandlerTeardown,
  JaypieHandlerValidate,
} from "@jaypie/express";

// Re-export constant via getter to lazy load
export const EXPRESS: ExpressModule["EXPRESS"] = new Proxy(
  {} as ExpressModule["EXPRESS"],
  {
    get(_, prop) {
      return loadPackage<ExpressModule>("@jaypie/express").EXPRESS[
        prop as keyof ExpressModule["EXPRESS"]
      ];
    },
  },
);

export function cors(
  ...args: Parameters<ExpressModule["cors"]>
): ReturnType<ExpressModule["cors"]> {
  return loadPackage<ExpressModule>("@jaypie/express").cors(...args);
}

export function expressHandler(
  ...args: Parameters<ExpressModule["expressHandler"]>
): ReturnType<ExpressModule["expressHandler"]> {
  return loadPackage<ExpressModule>("@jaypie/express").expressHandler(...args);
}

export function expressHttpCodeHandler(
  ...args: Parameters<ExpressModule["expressHttpCodeHandler"]>
): ReturnType<ExpressModule["expressHttpCodeHandler"]> {
  return loadPackage<ExpressModule>("@jaypie/express").expressHttpCodeHandler(
    ...args,
  );
}

// Route exports - these are pre-created handlers, so we use getters
export const badRequestRoute: ExpressModule["badRequestRoute"] = new Proxy(
  (() => {}) as unknown as ExpressModule["badRequestRoute"],
  {
    apply(_, thisArg, args) {
      return Reflect.apply(
        loadPackage<ExpressModule>("@jaypie/express").badRequestRoute,
        thisArg,
        args,
      );
    },
    get(_, prop) {
      const route = loadPackage<ExpressModule>("@jaypie/express")
        .badRequestRoute as unknown as Record<string, unknown>;
      return route[prop as string];
    },
  },
);

export const echoRoute: ExpressModule["echoRoute"] = new Proxy(
  (() => {}) as unknown as ExpressModule["echoRoute"],
  {
    apply(_, thisArg, args) {
      return Reflect.apply(
        loadPackage<ExpressModule>("@jaypie/express").echoRoute,
        thisArg,
        args,
      );
    },
    get(_, prop) {
      const route = loadPackage<ExpressModule>("@jaypie/express")
        .echoRoute as unknown as Record<string, unknown>;
      return route[prop as string];
    },
  },
);

export const forbiddenRoute: ExpressModule["forbiddenRoute"] = new Proxy(
  (() => {}) as unknown as ExpressModule["forbiddenRoute"],
  {
    apply(_, thisArg, args) {
      return Reflect.apply(
        loadPackage<ExpressModule>("@jaypie/express").forbiddenRoute,
        thisArg,
        args,
      );
    },
    get(_, prop) {
      const route = loadPackage<ExpressModule>("@jaypie/express")
        .forbiddenRoute as unknown as Record<string, unknown>;
      return route[prop as string];
    },
  },
);

export const goneRoute: ExpressModule["goneRoute"] = new Proxy(
  (() => {}) as unknown as ExpressModule["goneRoute"],
  {
    apply(_, thisArg, args) {
      return Reflect.apply(
        loadPackage<ExpressModule>("@jaypie/express").goneRoute,
        thisArg,
        args,
      );
    },
    get(_, prop) {
      const route = loadPackage<ExpressModule>("@jaypie/express")
        .goneRoute as unknown as Record<string, unknown>;
      return route[prop as string];
    },
  },
);

export const methodNotAllowedRoute: ExpressModule["methodNotAllowedRoute"] =
  new Proxy((() => {}) as unknown as ExpressModule["methodNotAllowedRoute"], {
    apply(_, thisArg, args) {
      return Reflect.apply(
        loadPackage<ExpressModule>("@jaypie/express").methodNotAllowedRoute,
        thisArg,
        args,
      );
    },
    get(_, prop) {
      const route = loadPackage<ExpressModule>("@jaypie/express")
        .methodNotAllowedRoute as unknown as Record<string, unknown>;
      return route[prop as string];
    },
  });

export const noContentRoute: ExpressModule["noContentRoute"] = new Proxy(
  (() => {}) as unknown as ExpressModule["noContentRoute"],
  {
    apply(_, thisArg, args) {
      return Reflect.apply(
        loadPackage<ExpressModule>("@jaypie/express").noContentRoute,
        thisArg,
        args,
      );
    },
    get(_, prop) {
      const route = loadPackage<ExpressModule>("@jaypie/express")
        .noContentRoute as unknown as Record<string, unknown>;
      return route[prop as string];
    },
  },
);

export const notFoundRoute: ExpressModule["notFoundRoute"] = new Proxy(
  (() => {}) as unknown as ExpressModule["notFoundRoute"],
  {
    apply(_, thisArg, args) {
      return Reflect.apply(
        loadPackage<ExpressModule>("@jaypie/express").notFoundRoute,
        thisArg,
        args,
      );
    },
    get(_, prop) {
      const route = loadPackage<ExpressModule>("@jaypie/express")
        .notFoundRoute as unknown as Record<string, unknown>;
      return route[prop as string];
    },
  },
);

export const notImplementedRoute: ExpressModule["notImplementedRoute"] =
  new Proxy((() => {}) as unknown as ExpressModule["notImplementedRoute"], {
    apply(_, thisArg, args) {
      return Reflect.apply(
        loadPackage<ExpressModule>("@jaypie/express").notImplementedRoute,
        thisArg,
        args,
      );
    },
    get(_, prop) {
      const route = loadPackage<ExpressModule>("@jaypie/express")
        .notImplementedRoute as unknown as Record<string, unknown>;
      return route[prop as string];
    },
  });
