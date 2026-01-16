// @jaypie/fabric/express - Express adapter for fabric services

// Main exports
export { fabricExpress, isFabricExpressMiddleware } from "./fabricExpress.js";
export { FabricRouter, isFabricExpressRouter } from "./FabricRouter.js";

// Types
export type {
  FabricExpressConfig,
  FabricExpressMiddleware,
  FabricExpressRouter,
  FabricRouterConfig,
  FabricRouterServiceEntry,
  Request,
  Response,
  Router,
} from "./types.js";
