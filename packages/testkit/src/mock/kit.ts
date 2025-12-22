import { createMockReturnedFunction } from "./utils";

export const isLocalEnv = createMockReturnedFunction(false);

export const isNodeTestEnv = createMockReturnedFunction(true);

export const isProductionEnv = createMockReturnedFunction(false);
