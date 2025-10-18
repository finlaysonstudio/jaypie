import { createMockReturnedFunction } from "./utils";

export const isProductionEnv = createMockReturnedFunction(false);

export const isNodeTestEnv = createMockReturnedFunction(true);
