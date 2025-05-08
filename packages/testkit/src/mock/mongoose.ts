import { createMockReturnedFunction } from "./utils";

// Mongoose mock functions
export const connect = createMockReturnedFunction(true);

export const connectFromSecretEnv = createMockReturnedFunction(true);

export const disconnect = createMockReturnedFunction(true);

export { mongoose } from "@jaypie/mongoose";
